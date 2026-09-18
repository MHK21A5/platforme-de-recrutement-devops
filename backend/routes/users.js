const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");

const {
  register,
  login,
  getUsers,
  getCandidates,
  getUserById,
  updateUser,
  deleteUser,
  createRecruiter,
  uploadCV,
  uploadProfileImage,
  getCandidateProfile,
  getMyProfile,
  updateMyProfile,
  getMyCVInfo,
  getCandidateCVInfo,
} = require("../controllers/userController");

router.post("/register", register);
router.post("/login", login);

// current user
router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);

// recruiter + admin
router.get("/candidates", authMiddleware, roleMiddleware(["recruiter", "admin"]), getCandidates);

router.post("/upload-cv", authMiddleware, roleMiddleware(["candidate"]), upload.single("cv"), uploadCV);
router.post("/upload-profile-image", authMiddleware, roleMiddleware(["candidate", "recruiter"]), upload.single("profileImage"), uploadProfileImage);

router.get("/candidates/:id/profile", authMiddleware, roleMiddleware(["recruiter", "admin"]), getCandidateProfile);

// CV info (parsed ATS data)
router.get("/cv-info", authMiddleware, roleMiddleware(["candidate"]), getMyCVInfo);
router.get("/candidates/:id/cv-info", authMiddleware, roleMiddleware(["recruiter", "admin"]), getCandidateCVInfo);

// admin only
router.post("/recruiters", authMiddleware, roleMiddleware(["admin"]), createRecruiter);
router.get("/", authMiddleware, roleMiddleware(["admin"]), getUsers);
router.get("/:id", authMiddleware, roleMiddleware(["admin"]), getUserById);
router.put("/:id", authMiddleware, roleMiddleware(["admin"]), updateUser);
router.delete("/:id", authMiddleware, roleMiddleware(["admin"]), deleteUser);

module.exports = router;
