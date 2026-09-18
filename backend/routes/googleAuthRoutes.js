const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  getAuthUrl,
  callback,
  status,
  disconnect,
} = require("../controllers/googleAuthController");

// /callback est appelé par une redirection de Google : pas de JWT possible.
// Sa protection repose sur la vérification du paramètre `state` (JWT signé).
router.get("/callback", callback);

router.get("/auth", authMiddleware, roleMiddleware(["recruiter", "admin"]), getAuthUrl);
router.get("/status", authMiddleware, roleMiddleware(["recruiter", "admin"]), status);
router.delete("/disconnect", authMiddleware, roleMiddleware(["recruiter", "admin"]), disconnect);

module.exports = router;
