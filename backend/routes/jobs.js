const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  createJob,
  getMyJobs,
  adminGetJobs,
  adminCreateJob,
  adminUpdateJob,
  adminDeleteJob,
} = require("../controllers/jobController");

// recruiter routes
router.post("/", authMiddleware, roleMiddleware(["recruiter", "admin"]), createJob);
router.get("/my", authMiddleware, roleMiddleware(["recruiter", "admin"]), getMyJobs);

// admin routes
router.get("/admin/all", authMiddleware, roleMiddleware(["admin"]), adminGetJobs);
router.post("/admin/create", authMiddleware, roleMiddleware(["admin"]), adminCreateJob);
router.put("/admin/:id", authMiddleware, roleMiddleware(["admin"]), adminUpdateJob);
router.delete("/admin/:id", authMiddleware, roleMiddleware(["admin"]), adminDeleteJob);

module.exports = router;