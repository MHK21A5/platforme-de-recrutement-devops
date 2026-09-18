/**
 * googleCalendarService.js — intégration Google Calendar (OAuth 2.0).
 *
 * Règles :
 *  - Les identifiants Google ne vivent que côté backend (jamais renvoyés au front).
 *  - Les jetons sont chiffrés au repos (services/tokenCrypto.js).
 *  - Aucun jeton n'est jamais journalisé.
 *  - Un échec Google ne doit JAMAIS bloquer la création d'un entretien : toutes
 *    les fonctions publiques renvoient un résultat, elles ne relancent pas.
 *
 * La visioconférence interne de l'application reste le lien de réunion : on ne
 * crée volontairement pas de Google Meet (conferenceData).
 */

const { google } = require("googleapis");
const User = require("../models/User");
const { encrypt, decrypt, isConfigured } = require("./tokenCrypto");

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

// L'entretien n'a pas de champ "durée" en base : on applique une valeur par
// défaut. Pour rendre la durée configurable, ajouter `durationMinutes` au
// modèle Interview et le lire ici.
const DEFAULT_DURATION_MINUTES = 60;

const TIMEZONE = () => process.env.GOOGLE_CALENDAR_TIMEZONE || "Africa/Tunis";
const FRONTEND = () => process.env.FRONTEND_URL || "http://localhost:5173";

/** true si les variables d'environnement Google sont présentes. */
function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      isConfigured()
  );
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/** URL du consentement Google. `state` protège contre le CSRF. */
function buildAuthUrl(state) {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline", // nécessaire pour obtenir un refresh_token
    prompt: "consent", // force la ré-émission du refresh_token
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/** Échange le code d'autorisation contre des jetons + l'email du compte. */
async function exchangeCodeForTokens(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email || null;
  } catch {
    // non bloquant : l'email n'est qu'un confort d'affichage
  }

  return { tokens, email };
}

/** Enregistre la connexion Google du recruteur (jetons chiffrés). */
async function saveRecruiterTokens(userId, tokens, email) {
  const update = {
    googleCalendarConnected: true,
    googleCalendarEmail: email,
    googleAccessToken: encrypt(tokens.access_token),
    googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };

  // Google ne renvoie le refresh_token qu'au premier consentement : ne jamais
  // écraser un refresh_token existant par null lors d'une reconnexion.
  if (tokens.refresh_token) {
    update.googleRefreshToken = encrypt(tokens.refresh_token);
  }

  await User.findByIdAndUpdate(userId, update);
}

/** Efface la connexion Google localement. */
async function clearRecruiterTokens(userId) {
  await User.findByIdAndUpdate(userId, {
    googleCalendarConnected: false,
    googleCalendarEmail: null,
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
  });
}

/** Révoque l'autorisation côté Google puis efface localement. */
async function disconnect(userId) {
  const user = await User.findById(userId).select("+googleRefreshToken +googleAccessToken");
  const token = decrypt(user?.googleRefreshToken) || decrypt(user?.googleAccessToken);

  if (token) {
    try {
      await createOAuthClient().revokeToken(token);
    } catch {
      // déjà révoqué / réseau : on efface quand même côté application
    }
  }
  await clearRecruiterTokens(userId);
}

/**
 * Client OAuth authentifié pour un recruteur, avec rafraîchissement automatique.
 * Renvoie null si le recruteur n'a pas connecté Google.
 */
async function getAuthorizedClient(userId) {
  if (!isGoogleConfigured()) return null;

  const user = await User.findById(userId).select(
    "+googleAccessToken +googleRefreshToken googleCalendarConnected googleTokenExpiry"
  );
  if (!user || !user.googleCalendarConnected) return null;

  const refreshToken = decrypt(user.googleRefreshToken);
  const accessToken = decrypt(user.googleAccessToken);
  if (!refreshToken && !accessToken) return null;

  const client = createOAuthClient();
  client.setCredentials({
    access_token: accessToken || undefined,
    refresh_token: refreshToken || undefined,
    expiry_date: user.googleTokenExpiry ? user.googleTokenExpiry.getTime() : undefined,
  });

  // googleapis rafraîchit tout seul le jeton expiré et émet "tokens" : on
  // persiste la nouvelle valeur pour éviter un refresh à chaque appel.
  client.on("tokens", (t) => {
    const update = {};
    if (t.access_token) update.googleAccessToken = encrypt(t.access_token);
    if (t.refresh_token) update.googleRefreshToken = encrypt(t.refresh_token);
    if (t.expiry_date) update.googleTokenExpiry = new Date(t.expiry_date);
    if (Object.keys(update).length) {
      User.findByIdAndUpdate(userId, update).catch(() => {});
    }
  });

  return client;
}

/** Accès révoqué côté Google → on marque le compte comme déconnecté. */
async function handleGoogleError(userId, error) {
  const reason = error?.response?.data?.error || error?.message || "unknown";
  if (String(reason).includes("invalid_grant")) {
    await clearRecruiterTokens(userId).catch(() => {});
    return "access_revoked";
  }
  return reason;
}

function buildDescription({ interview, job, candidate, recruiter }) {
  const roomLink = `${FRONTEND()}/interview/${interview._id}`;
  const prepLink = `${FRONTEND()}/interview-prep`;

  return [
    `Candidat  : ${candidate?.name || "—"}`,
    `Recruteur : ${recruiter?.name || "—"}`,
    `Poste     : ${job?.title || "—"}`,
    `Entretien : ${interview.title}`,
    "",
    `Salle d'entretien : ${roomLink}`,
    `Préparation       : ${prepLink}`,
    "",
    "— STB Recruitment",
  ].join("\n");
}

function buildEventBody({ interview, job, candidate, recruiter }) {
  const start = new Date(interview.scheduledAt);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000);

  const body = {
    summary: `Interview – ${job?.title || interview.title}`,
    description: buildDescription({ interview, job, candidate, recruiter }),
    location: "Online – STB Recruitment",
    start: { dateTime: start.toISOString(), timeZone: TIMEZONE() },
    end: { dateTime: end.toISOString(), timeZone: TIMEZONE() },
  };

  // Le recruteur est l'organisateur de son propre agenda : l'ajouter en invité
  // ferait doublon. Seul le candidat est invité.
  if (candidate?.email) {
    body.attendees = [{ email: candidate.email, displayName: candidate.name || undefined }];
  }

  return body;
}

/**
 * Crée l'événement. Ne lance jamais.
 * → { created: false, reason } | { created: true, eventId, htmlLink }
 */
async function createInterviewEvent({ interview, job, candidate, recruiter }) {
  const recruiterId = recruiter?._id || recruiter;

  const client = await getAuthorizedClient(recruiterId);
  if (!client) return { created: false, reason: "not_connected" };
  if (!candidate?.email) return { created: false, reason: "missing_candidate_email" };

  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    const res = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all", // envoie l'invitation au candidat
      requestBody: buildEventBody({ interview, job, candidate, recruiter }),
    });
    return { created: true, eventId: res.data.id, htmlLink: res.data.htmlLink };
  } catch (error) {
    const reason = await handleGoogleError(recruiterId, error);
    console.error(`[GoogleCalendar] création échouée (interview ${interview._id}): ${reason}`);
    return { created: false, reason };
  }
}

/** Met à jour l'événement (replanification). Ne lance jamais. */
async function updateInterviewEvent({ interview, job, candidate, recruiter }) {
  const recruiterId = recruiter?._id || recruiter;
  if (!interview.googleCalendarEventId) return { updated: false, reason: "no_event" };

  const client = await getAuthorizedClient(recruiterId);
  if (!client) return { updated: false, reason: "not_connected" };

  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId: interview.googleCalendarEventId,
      sendUpdates: "all",
      requestBody: buildEventBody({ interview, job, candidate, recruiter }),
    });
    return { updated: true, htmlLink: res.data.htmlLink };
  } catch (error) {
    const reason = await handleGoogleError(recruiterId, error);
    console.error(`[GoogleCalendar] mise à jour échouée (interview ${interview._id}): ${reason}`);
    return { updated: false, reason };
  }
}

/** Supprime l'événement (annulation). Ne lance jamais. */
async function deleteInterviewEvent({ interview, recruiter }) {
  const recruiterId = recruiter?._id || recruiter;
  if (!interview.googleCalendarEventId) return { deleted: false, reason: "no_event" };

  const client = await getAuthorizedClient(recruiterId);
  if (!client) return { deleted: false, reason: "not_connected" };

  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.delete({
      calendarId: "primary",
      eventId: interview.googleCalendarEventId,
      sendUpdates: "all", // prévient le candidat de l'annulation
    });
    return { deleted: true };
  } catch (error) {
    // 404/410 : l'événement a déjà été supprimé côté Google → succès idempotent
    const status = error?.response?.status;
    if (status === 404 || status === 410) return { deleted: true };

    const reason = await handleGoogleError(recruiterId, error);
    console.error(`[GoogleCalendar] suppression échouée (interview ${interview._id}): ${reason}`);
    return { deleted: false, reason };
  }
}

module.exports = {
  SCOPES,
  DEFAULT_DURATION_MINUTES,
  isGoogleConfigured,
  buildAuthUrl,
  exchangeCodeForTokens,
  saveRecruiterTokens,
  clearRecruiterTokens,
  disconnect,
  getAuthorizedClient,
  buildEventBody,
  createInterviewEvent,
  updateInterviewEvent,
  deleteInterviewEvent,
};
