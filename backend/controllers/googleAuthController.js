const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const googleCalendar = require("../services/googleCalendarService");

const FRONTEND = () => process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Le paramètre `state` est un JWT court : il protège du CSRF (Google nous le
 * renvoie tel quel) ET identifie le recruteur dans le callback, qui arrive par
 * redirection navigateur et n'a donc pas d'en-tête Authorization.
 */
function buildState(userId) {
  return jwt.sign(
    { id: userId, nonce: crypto.randomBytes(16).toString("hex") },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}

// RECRUITER/ADMIN -> URL du consentement Google
// Renvoie l'URL en JSON (le front redirige) : le JWT étant dans localStorage,
// une redirection directe du navigateur ne porterait pas l'en-tête d'auth.
exports.getAuthUrl = async (req, res) => {
  try {
    if (!googleCalendar.isGoogleConfigured()) {
      return res.status(503).json({
        message:
          "Google Calendar n'est pas configuré sur le serveur. Renseignez les variables GOOGLE_* dans backend/.env.",
      });
    }

    res.status(200).json({ url: googleCalendar.buildAuthUrl(buildState(req.user.id)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GOOGLE -> callback OAuth (redirection navigateur, pas de JWT d'en-tête)
exports.callback = async (req, res) => {
  const redirect = (params) =>
    res.redirect(`${FRONTEND()}/dashboard?tab=profile&${params}`);

  try {
    const { code, state, error: googleError } = req.query;

    if (googleError) return redirect("google=denied");
    if (!code || !state) return redirect("google=error");

    let payload;
    try {
      payload = jwt.verify(state, process.env.JWT_SECRET); // CSRF + identité
    } catch {
      return redirect("google=error");
    }

    const user = await User.findById(payload.id);
    if (!user || (user.role !== "recruiter" && user.role !== "admin")) {
      return redirect("google=error");
    }

    const { tokens, email } = await googleCalendar.exchangeCodeForTokens(code);
    await googleCalendar.saveRecruiterTokens(payload.id, tokens, email);

    return redirect("google=connected");
  } catch (error) {
    // Jamais de détail Google (ni jeton) exposé à l'utilisateur.
    console.error(`[GoogleAuth] callback échoué: ${error.message}`);
    return redirect("google=error");
  }
};

// RECRUITER/ADMIN -> état de la connexion (aucun jeton renvoyé)
exports.status = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "googleCalendarConnected googleCalendarEmail"
    );

    res.status(200).json({
      configured: googleCalendar.isGoogleConfigured(),
      connected: Boolean(user?.googleCalendarConnected),
      email: user?.googleCalendarEmail || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER/ADMIN -> révoque l'accès Google et efface les jetons
exports.disconnect = async (req, res) => {
  try {
    await googleCalendar.disconnect(req.user.id);
    res.status(200).json({ message: "Google Calendar disconnected" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
