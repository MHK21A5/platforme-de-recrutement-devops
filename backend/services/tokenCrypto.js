/**
 * tokenCrypto.js — chiffrement au repos des jetons OAuth Google.
 *
 * AES-256-GCM via le module `crypto` natif de Node (aucune dépendance ajoutée).
 * GCM est authentifié : toute altération du chiffré est détectée au déchiffrement.
 *
 * Clé : GOOGLE_TOKEN_ENC_KEY = 64 caractères hex (32 octets).
 *   Générer :  openssl rand -hex 32
 *
 * Format stocké : "<iv hex>:<authTag hex>:<chiffré hex>"
 *
 * ⚠ Si la clé change, les jetons existants deviennent indéchiffrables :
 *    les recruteurs devront simplement reconnecter leur Google Calendar.
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // taille recommandée pour GCM

function getKey() {
  const raw = process.env.GOOGLE_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error(
      "GOOGLE_TOKEN_ENC_KEY manquante — requise pour chiffrer les jetons Google."
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "GOOGLE_TOKEN_ENC_KEY invalide — attendu 64 caractères hex (32 octets)."
    );
  }
  return key;
}

/** true si une clé valide est configurée (sans jamais exposer la clé). */
function isConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

function encrypt(plainText) {
  if (plainText === null || plainText === undefined || plainText === "") return null;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(payload) {
  if (!payload) return null;

  const parts = String(payload).split(":");
  if (parts.length !== 3) return null; // format inattendu → traité comme absent

  const [ivHex, tagHex, dataHex] = parts;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Clé changée / donnée corrompue. On ne journalise jamais le contenu.
    return null;
  }
}

module.exports = { encrypt, decrypt, isConfigured };
