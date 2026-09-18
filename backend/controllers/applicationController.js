const Application = require("../models/Application");
const Job = require("../models/Job");
const CVInfo = require("../models/CVInfo");
const User = require("../models/User");
const Interview = require("../models/Interview");
const { getIO } = require("../socket/socketIO");
const { createNotification } = require("../services/notificationService");
const googleCalendar = require("../services/googleCalendarService");

// ─── Scoring Helpers ──────────────────────────────────────────────────────────

function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/\d{4}/);
  return match ? parseInt(match[0]) : null;
}

function isPresent(dateStr) {
  if (!dateStr) return true;
  return /present|current|now|aujourd|actuel/i.test(String(dateStr));
}

/**
 * Compute an intelligent match score (0–100) between a candidate's CVInfo
 * and a Job posting.
 *
 * Breakdown:
 *  - Skills match       50 pts  (required skills found in candidate skills)
 *  - Experience years   30 pts  (candidate computed years vs. job minExperienceYears)
 *  - Education          20 pts  (has education + field relevance bonus)
 */
function computeMatchScore(cvInfo, job) {
  if (!cvInfo || !job) {
    return { total: 0, breakdown: { skills: null, experience: null, education: null } };
  }

  let total = 0;
  const breakdown = {};

  // ── 1. Skills (50 pts) ─────────────────────────────────────────────────────
  const requiredSkills = (job.requiredSkills || []).map((s) => s.toLowerCase().trim());
  const candidateSkills = (cvInfo.skills || []).map((s) => s.toLowerCase().trim());

  if (requiredSkills.length > 0) {
    const matchedSkills = requiredSkills.filter((rs) =>
      candidateSkills.some((cs) => cs.includes(rs) || rs.includes(cs))
    );
    const skillScore = Math.round((matchedSkills.length / requiredSkills.length) * 50);
    total += skillScore;
    breakdown.skills = {
      score: skillScore,
      max: 50,
      matched: matchedSkills.length,
      total: requiredSkills.length,
      matchedList: matchedSkills,
    };
  } else {
    // No required skills defined → give neutral 25/50
    total += 25;
    breakdown.skills = { score: 25, max: 50, note: "No required skills specified" };
  }

  // ── 2. Experience years (30 pts) ──────────────────────────────────────────
  const experiences = cvInfo.experience || [];
  const minYears = job.minExperienceYears || 0;
  const currentYear = new Date().getFullYear();

  let totalExpYears = 0;
  experiences.forEach((exp) => {
    const startYear = extractYear(exp.startDate) || currentYear;
    const endYear = isPresent(exp.endDate)
      ? currentYear
      : extractYear(exp.endDate) || currentYear;
    totalExpYears += Math.max(0, endYear - startYear);
  });

  let expScore;
  if (minYears === 0) {
    expScore = experiences.length > 0 ? 30 : 15;
  } else {
    expScore = Math.round(Math.min(1, totalExpYears / minYears) * 30);
  }
  total += expScore;
  breakdown.experience = {
    score: expScore,
    max: 30,
    calculatedYears: Math.round(totalExpYears * 10) / 10,
    requiredYears: minYears,
  };

  // ── 3. Education (20 pts) ─────────────────────────────────────────────────
  const educations = cvInfo.education || [];
  let eduScore = 0;
  if (educations.length > 0) {
    eduScore = 15; // base credit for having education
    // Bonus 5 pts if education field/degree matches job keywords
    const jobText = `${job.title || ""} ${job.position || ""} ${job.description || ""}`.toLowerCase();
    const jobWords = [...new Set(jobText.split(/\W+/).filter((w) => w.length > 4))];
    const hasRelevant = educations.some((edu) => {
      const text = `${edu.field || ""} ${edu.degree || ""}`.toLowerCase();
      return jobWords.some((kw) => text.includes(kw));
    });
    if (hasRelevant) eduScore = 20;
  }
  total += eduScore;
  breakdown.education = { score: eduScore, max: 20 };

  return { total: Math.min(100, total), breakdown };
}

// CANDIDATE -> APPLY TO JOB
exports.applyToJob = async (req, res) => {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can apply" });
    }

    const job = await Job.findById(req.params.jobId);

    if (!job || job.status !== "open") {
      return res.status(404).json({ message: "Job not found or closed" });
    }

    // A unique index on (job, candidate) means there is at most one application
    // per job per candidate. A rejected candidate may apply again: the existing
    // row is revived as a fresh "pending" application rather than duplicated.
    const existing = await Application.findOne({ job: job._id, candidate: req.user.id });

    let application;
    if (existing) {
      if (existing.status !== "rejected") {
        return res.status(400).json({ message: "You already applied to this job" });
      }
      existing.status = "pending";
      existing.createdAt = new Date();
      application = await existing.save();
    } else {
      application = await Application.create({
        job: job._id,
        candidate: req.user.id,
        recruiter: job.recruiter,
      });
    }

    const candidate = await User.findById(req.user.id).select("name");
    const io = getIO();
    if (io) {
      io.to(`user-${job.recruiter}`).emit("application:new", application);
    }
    createNotification({
      recipient: job.recruiter,
      type: "application_new",
      title: "New application",
      message: `${candidate?.name || "A candidate"} applied to ${job.title}`,
      link: "/dashboard",
      relatedId: application._id,
    }).catch((err) => console.error("[Notification] application_new failed:", err.message));

    res.status(201).json(application);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "You already applied to this job" });
    }

    res.status(500).json({ error: error.message });
  }
};

// CANDIDATE -> GET OPEN JOBS
exports.getOpenJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ status: "open" })
      .populate("recruiter", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // "rejected" is excluded on purpose: a rejected candidate may apply again.
    const myApplications = await Application.find({
      candidate: req.user.id,
      status: { $in: ["pending", "accepted"] },
    }).select("job");
    const appliedJobIds = new Set(myApplications.map((a) => a.job.toString()));

    const jobsWithCount = await Promise.all(
      jobs.map(async (job) => {
        const count = await Application.countDocuments({ job: job._id });
        return {
          ...job,
          applicationsCount: count,
          alreadyApplied: appliedJobIds.has(job._id.toString()),
        };
      })
    );

    res.status(200).json(jobsWithCount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> GET APPLICATIONS
exports.getMyApplications = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return res.status(403).json({ message: "Only recruiters can view applications" });
    }

    const applications = await Application.find({ recruiter: req.user.id, status: "pending" })
      .populate("job")
      .populate("candidate", "name email role cv profileImage")
      .sort({ createdAt: -1 });

    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> ACCEPT APPLICATION
exports.acceptApplication = async (req, res) => {
  try {
    const application = await Application.findOneAndUpdate(
      {
        _id: req.params.id,
        recruiter: req.user.id,
        status: "pending",
      },
      { status: "accepted" },
      { returnDocument: "after" }
    );

    if (!application) {
      return res.status(404).json({ message: "Pending application not found" });
    }

    res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> REJECT APPLICATION
// RECRUITER -> REMOVE A CANDIDATE FROM HIS OWN PIPELINE
// Deletes only the candidature for THIS recruiter's job, and cancels the
// interview scheduled for it, if any. The candidate's account and any
// application to another recruiter's job are left untouched — a recruiter must
// never be able to destroy another recruiter's pipeline.
exports.removeApplication = async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      recruiter: req.user.id,
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Cancel the matching interview (Google event included) — interviews and
    // applications share no foreign key, so they are matched on (job, candidate).
    const interview = await Interview.findOne({
      job: application.job,
      candidate: application.candidate,
    });

    let interviewCancelled = false;
    if (interview) {
      if (interview.googleCalendarEventId) {
        await googleCalendar.deleteInterviewEvent({
          interview,
          recruiter: interview.recruiter,
        });
      }
      await interview.deleteOne();
      interviewCancelled = true;
    }

    await application.deleteOne();

    const io = getIO();
    if (io) {
      io.to(`user-${req.user.id}`).emit("application:updated", { _id: application._id });
      if (interviewCancelled) {
        io.to(`user-${application.candidate}`).emit("interview:updated", {
          _id: interview._id,
        });
      }
    }

    res.status(200).json({
      message: "Candidate removed from your pipeline",
      interviewCancelled,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.rejectApplication = async (req, res) => {
  try {
    const application = await Application.findOneAndUpdate(
      {
        _id: req.params.id,
        recruiter: req.user.id,
        status: "pending",
      },
      { status: "rejected" },
      { returnDocument: "after" }
    );

    if (!application) {
      return res.status(404).json({ message: "Pending application not found" });
    }

    res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> GET CANDIDATE DETAILS + INTELLIGENT SCORE
exports.getCandidateDetails = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return res.status(403).json({ message: "Only recruiters can view candidate details" });
    }

    // Verify the application belongs to this recruiter
    const application = await Application.findOne({
      _id: req.params.id,
      recruiter: req.user.id,
    })
      .populate("job")
      .populate("candidate", "name email profileImage cv createdAt");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Fetch CVInfo for this candidate
    const cvInfo = await CVInfo.findOne({ user: application.candidate._id });

    // Compute intelligent match score
    const score = computeMatchScore(cvInfo, application.job);

    res.status(200).json({
      candidate: application.candidate,
      job: application.job,
      cvInfo: cvInfo || null,
      score,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};