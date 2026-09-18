const Job = require("../models/Job");
const { getIO } = require("../socket/socketIO");

// RECRUITER -> CREATE JOB
exports.createJob = async (req, res) => {
  try {
    if (req.user.role !== "recruiter" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only recruiters or admins can create jobs" });
    }

    const {
      title,
      position,
      description,
      requiredSkills,
      experienceLevel,
      minExperienceYears,
      location,
      status,
    } = req.body;

    const skillsArray = Array.isArray(requiredSkills)
      ? requiredSkills
      : String(requiredSkills || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    const job = await Job.create({
      title,
      position,
      description,
      requiredSkills: skillsArray,
      experienceLevel,
      minExperienceYears,
      location,
      status: status || "open",
      recruiter: req.user.id,
    });

    if (job.status !== "closed") {
      const io = getIO();
      if (io) io.to("role-candidate").emit("job:new", job);
    }

    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> GET OWN JOBS
exports.getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ recruiter: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> GET ALL JOBS
exports.adminGetJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate("recruiter", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> UPDATE JOB
exports.adminUpdateJob = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.requiredSkills && !Array.isArray(updateData.requiredSkills)) {
      updateData.requiredSkills = String(updateData.requiredSkills)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const job = await Job.findByIdAndUpdate(req.params.id, updateData, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> DELETE JOB
exports.adminDeleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({ message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> CREATE JOB (with explicit recruiter assignment)
exports.adminCreateJob = async (req, res) => {
  try {
    const {
      title,
      position,
      description,
      requiredSkills,
      experienceLevel,
      minExperienceYears,
      location,
      status,
      recruiter,
    } = req.body;

    if (!recruiter) {
      return res.status(400).json({ message: "Recruiter is required" });
    }

    const skillsArray = Array.isArray(requiredSkills)
      ? requiredSkills
      : String(requiredSkills || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    const job = await Job.create({
      title,
      position,
      description,
      requiredSkills: skillsArray,
      experienceLevel: experienceLevel || "junior",
      minExperienceYears: minExperienceYears || 0,
      location,
      status: status || "open",
      recruiter,
    });

    const populated = await job.populate("recruiter", "name email role");
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};