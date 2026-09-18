const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  applyToJob,
  getOpenJobs,
  getMyApplications,
  acceptApplication,
  rejectApplication,
  removeApplication,
  getCandidateDetails,
} = require("../controllers/applicationController");

router.get("/jobs/open", authMiddleware, roleMiddleware(["candidate"]), getOpenJobs);
router.post("/apply/:jobId", authMiddleware, roleMiddleware(["candidate"]), applyToJob);

router.get("/recruiter", authMiddleware, roleMiddleware(["recruiter"]), getMyApplications);

router.put(
  "/:id/accept",
  authMiddleware,
  roleMiddleware(["recruiter"]),
  acceptApplication
);

router.put(
  "/:id/reject",
  authMiddleware,
  roleMiddleware(["recruiter"]),
  rejectApplication
);

router.get(
  "/:id/candidate-details",
  authMiddleware,
  roleMiddleware(["recruiter"]),
  getCandidateDetails
);

// Removes the candidate from this recruiter's pipeline (application + interview)
router.delete("/:id", authMiddleware, roleMiddleware(["recruiter"]), removeApplication);

module.exports = router;