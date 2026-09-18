const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  createInterview,
  getMyInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  adminGetInterviews,
  adminGetQuizResults,
  adminGetQuizResultById,
  adminCreateInterview,
  adminUpdateInterview,
  adminDeleteInterview,
  generateQuiz,
  startQuiz,
  getQuiz,
  submitQuizAnswer,
  completeQuiz,
  getQuizResult,
  getQuizResults,
  generatePrepTips,
} = require("../controllers/interviewController");

// admin routes first
router.get("/admin/all", authMiddleware, roleMiddleware(["admin"]), adminGetInterviews);
router.get("/admin/quiz-results", authMiddleware, roleMiddleware(["admin"]), adminGetQuizResults);
router.get("/admin/quiz-results/:id", authMiddleware, roleMiddleware(["admin"]), adminGetQuizResultById);
router.get("/quiz-results", authMiddleware, getQuizResults);
router.post("/admin/create", authMiddleware, roleMiddleware(["admin"]), adminCreateInterview);
router.put("/admin/:id", authMiddleware, roleMiddleware(["admin"]), adminUpdateInterview);
router.delete("/admin/:id", authMiddleware, roleMiddleware(["admin"]), adminDeleteInterview);

// normal routes
router.get("/", authMiddleware, getMyInterviews);
router.post("/", authMiddleware, createInterview);
router.get("/:id/quiz", authMiddleware, getQuiz);
router.post("/:id/quiz/generate", authMiddleware, roleMiddleware(["recruiter", "admin"]), generateQuiz);
router.post("/:id/quiz/start", authMiddleware, roleMiddleware(["recruiter", "admin"]), startQuiz);
router.post("/:id/quiz/answer", authMiddleware, roleMiddleware(["candidate"]), submitQuizAnswer);
router.post("/:id/quiz/complete", authMiddleware, roleMiddleware(["recruiter", "admin"]), completeQuiz);
router.get("/:id/quiz/result", authMiddleware, getQuizResult);
router.get("/:id", authMiddleware, getInterviewById);
router.post("/:id/prep-tips", authMiddleware, generatePrepTips);
router.put("/:id", authMiddleware, updateInterview);
router.delete("/:id", authMiddleware, deleteInterview);

module.exports = router;