const Interview = require("../models/Interview");
const Application = require("../models/Application");
const QuizResult = require("../models/QuizResult");
const ollamaService = require("../utils/ollamaService");
const { getIO } = require("../socket/socketIO");
const { sendInterviewInvitation } = require("../services/emailService");
const { createNotification } = require("../services/notificationService");
const googleCalendar = require("../services/googleCalendarService");

function sanitizeQuizForCandidate(quiz) {
  if (!quiz) return null;

  const totalQuestions = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
  const answeredCount = Array.isArray(quiz.answers) ? quiz.answers.length : 0;
  const currentQuestion = Array.isArray(quiz.questions) ? quiz.questions[answeredCount] : null;

  return {
    status: quiz.status,
    generatedAt: quiz.generatedAt,
    startedAt: quiz.startedAt,
    completedAt: quiz.completedAt,
    score: quiz.score,
    totalQuestions,
    answeredCount,
    answers: Array.isArray(quiz.answers) ? quiz.answers : [],
    currentQuestion: currentQuestion
      ? {
          questionId: currentQuestion.questionId,
          prompt: currentQuestion.prompt,
          options: currentQuestion.options,
        }
      : null,
  };
}

function getParticipantId(participant) {
  if (!participant) return null;
  return participant._id?.toString?.() || participant.id?.toString?.() || participant.toString?.();
}

function computeQuizScore(answers, totalQuestions) {
  if (!Array.isArray(answers) || totalQuestions <= 0) {
    return 0;
  }

  const correctCount = answers.filter((a) => a.isCorrect).length;
  return Math.round((correctCount / totalQuestions) * 100);
}

function emitQuizEvent(interviewId, event, payload) {
  const io = getIO();
  if (!io) return;
  io.to(`interview-${interviewId}`).emit(event, payload);
}

/**
 * Deleting an interview cancels the meeting, not the candidature: the linked
 * application goes back to "pending" so the recruiter finds it in their queue
 * again and can re-schedule. Interviews and applications share no foreign key,
 * so they are matched on the (job, candidate) pair.
 */
async function restoreApplicationToPending(interview) {
  const jobId = interview.job?._id || interview.job;
  const candidateId = getParticipantId(interview.candidate);
  if (!jobId || !candidateId) return;

  const application = await Application.findOneAndUpdate(
    { job: jobId, candidate: candidateId, status: "accepted" },
    { status: "pending" },
    { new: true }
  );
  if (!application) return;

  const io = getIO();
  if (io) {
    io.to(`user-${application.recruiter}`).emit("application:updated", application);
  }
}

/**
 * Reflects a reschedule on the recruiter's Google Calendar. No-op when the
 * interview was never synced. Never throws: the interview is already saved and
 * a Google failure must not fail the request.
 */
async function syncRescheduledEvent(interview) {
  if (!interview.googleCalendarEventId) return;

  const populated = await Interview.findById(interview._id)
    .populate("candidate", "name email")
    .populate("recruiter", "name")
    .populate("job", "title position");

  const result = await googleCalendar.updateInterviewEvent({
    interview: populated,
    job: populated.job,
    candidate: populated.candidate,
    recruiter: populated.recruiter,
  });

  interview.googleCalendarSyncStatus = result.updated ? "synced" : "failed";
  await interview.save();
}

/** Cancels the Google Calendar event (attendees are notified). Never throws. */
async function syncCancelledEvent(interview) {
  if (!interview.googleCalendarEventId) return;

  await googleCalendar.deleteInterviewEvent({
    interview,
    recruiter: interview.recruiter,
  });
}

// RECRUITER -> CREATE OWN INTERVIEW
exports.createInterview = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return res.status(403).json({ message: "Only recruiters can create interviews" });
    }

    const { title, job, candidate, scheduledAt } = req.body;

    const interview = await Interview.create({
      title,
      job,
      candidate,
      scheduledAt,
      recruiter: req.user.id,
      status: "pending",
    });

    // Populate needed for email — done after save so it never blocks creation
    const populated = await Interview.findById(interview._id)
      .populate("candidate", "name email")
      .populate("recruiter", "name")
      .populate("job", "title position");

    const io = getIO();
    if (io) {
      io.to(`user-${candidate}`).emit("interview:new", populated);
    }
    createNotification({
      recipient: candidate,
      type: "interview_scheduled",
      title: "Interview scheduled",
      message: `${populated.title} on ${new Date(scheduledAt).toLocaleString()}`,
      link: `/interview/${interview._id}`,
      relatedId: interview._id,
    }).catch((err) => console.error("[Notification] interview_scheduled failed:", err.message));

    // ── Send invitation email (non-blocking) ──────────────────────────────
    let emailSent = false;
    try {
      const dt = new Date(scheduledAt);
      const interviewDate = dt.toLocaleDateString("en-GB", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      const interviewTime = dt.toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", timeZoneName: "short",
      });

      await sendInterviewInvitation({
        candidateEmail: populated.candidate.email,
        candidateName:  populated.candidate.name,
        recruiterName:  populated.recruiter.name,
        interviewTitle: populated.title,
        jobTitle:       populated.job?.title || "Open Position",
        interviewDate,
        interviewTime,
        meetingLink: `${process.env.FRONTEND_URL || "http://localhost:5173"}/interview/${interview._id}`,
        prepLink:    `${process.env.FRONTEND_URL || "http://localhost:5173"}/interview-prep`,
      });
      emailSent = true;
      console.log(`[Email] Invitation sent to ${populated.candidate.email} for interview ${interview._id}`);
    } catch (emailErr) {
      // Log safely — no credentials in the message
      console.error(`[Email] Failed to send invitation for interview ${interview._id}: ${emailErr.message}`);
    }

    // ── Google Calendar (non-blocking) ────────────────────────────────────
    // The interview is already saved: a Google failure must never fail the
    // request. Errors are swallowed by the service, which returns a result.
    const calendarResult = await googleCalendar.createInterviewEvent({
      interview: populated,
      job: populated.job,
      candidate: populated.candidate,
      recruiter: populated.recruiter,
    });

    if (calendarResult.created) {
      interview.googleCalendarEventId = calendarResult.eventId;
      interview.googleCalendarHtmlLink = calendarResult.htmlLink;
      interview.googleCalendarSyncStatus = "synced";
    } else {
      interview.googleCalendarSyncStatus =
        calendarResult.reason === "not_connected" ? "not_connected" : "failed";
    }
    await interview.save();

    return res.status(201).json({
      ...populated.toObject(),
      emailSent,
      calendarEventCreated: calendarResult.created,
      googleCalendarSyncStatus: interview.googleCalendarSyncStatus,
      googleCalendarHtmlLink: interview.googleCalendarHtmlLink || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER/CANDIDATE -> GET MY INTERVIEWS
exports.getMyInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({
      $or: [{ recruiter: req.user.id }, { candidate: req.user.id }],
    })
      .populate("recruiter candidate", "name email role ")
      .populate("job");

    const result = interviews.map((interview) => {
      const interviewObject = interview.toObject();
      if (req.user.role === "candidate" && interviewObject.quiz) {
        interviewObject.quiz = sanitizeQuizForCandidate(interviewObject.quiz);
      }
      return interviewObject;
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ONE INTERVIEW (owner recruiter/candidate)
exports.getInterviewById = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id).populate(
  "recruiter candidate",
  "name email role cv profileImage"
).populate("job");


    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const isRecruiter = interview.recruiter?._id?.toString() === req.user.id;
    const isCandidate = interview.candidate?._id?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isRecruiter && !isCandidate && !isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    const interviewObject = interview.toObject();
    if (isCandidate && interviewObject.quiz) {
      interviewObject.quiz = sanitizeQuizForCandidate(interviewObject.quiz);
    }

    res.status(200).json(interviewObject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> GENERATE QUIZ FOR INTERVIEW
exports.generateQuiz = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate("recruiter candidate", "name email role")
      .populate("job");

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (req.user.role !== "recruiter" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only recruiters can generate quizzes" });
    }

    const recruiterId = getParticipantId(interview.recruiter);
    if (req.user.role === "recruiter" && recruiterId !== req.user.id) {
      return res.status(403).json({ message: "You can only generate a quiz for your own interview" });
    }

    if (!interview.job) {
      return res.status(400).json({ message: "Interview must be tied to a job before generating a quiz" });
    }

    if (interview.quiz?.status === "in_progress") {
      return res.status(400).json({ message: "Quiz is already in progress" });
    }

    const questions = await ollamaService.generateQuizQuestions(interview.job, interview.title);

    interview.quiz = {
      status: "ready",
      generatedAt: new Date(),
      startedAt: null,
      completedAt: null,
      score: 0,
      questions,
      answers: [],
    };

    await interview.save();

    emitQuizEvent(interview._id.toString(), "quiz:generated", {
      status: interview.quiz.status,
      totalQuestions: interview.quiz.questions.length,
      generatedAt: interview.quiz.generatedAt,
    });

    res.status(200).json({ quiz: interview.quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> START QUIZ
exports.startQuiz = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate("recruiter candidate", "name email role")
      .populate("job");

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (req.user.role !== "recruiter" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only recruiters can start quizzes" });
    }

    const recruiterId = getParticipantId(interview.recruiter);
    if (req.user.role === "recruiter" && recruiterId !== req.user.id) {
      return res.status(403).json({ message: "You can only start a quiz for your own interview" });
    }

    if (!interview.quiz || interview.quiz.status !== "ready") {
      return res.status(400).json({ message: "Quiz must be generated before it can be started" });
    }

    interview.quiz.status = "in_progress";
    interview.quiz.startedAt = new Date();
    interview.quiz.completedAt = null;
    interview.quiz.score = 0;
    interview.quiz.answers = interview.quiz.answers || [];

    await interview.save();

    emitQuizEvent(interview._id.toString(), "quiz:started", {
      status: interview.quiz.status,
      totalQuestions: interview.quiz.questions.length,
      startedAt: interview.quiz.startedAt,
    });

    res.status(200).json({ quiz: interview.quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET QUIZ STATE
exports.getQuiz = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate("recruiter candidate", "name email role")
      .populate("job");

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const isRecruiter = interview.recruiter?._id?.toString() === req.user.id;
    const isCandidate = interview.candidate?._id?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isRecruiter && !isCandidate && !isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!interview.quiz) {
      return res.status(200).json({ quiz: null });
    }

    const quiz = isCandidate ? sanitizeQuizForCandidate(interview.quiz) : interview.quiz;
    res.status(200).json({ quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getQuizResult = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate("recruiter candidate", "name email role")
      .populate("job");

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const isRecruiter = interview.recruiter?._id?.toString() === req.user.id;
    const isCandidate = interview.candidate?._id?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isRecruiter && !isCandidate && !isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    const quizResult = await QuizResult.findOne({ interview: interview._id })
      .populate("recruiter candidate job", "name email role title position");

    if (!quizResult) {
      return res.status(200).json({ quizResult: null });
    }

    res.status(200).json({ quizResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CANDIDATE -> SUBMIT QUIZ ANSWER
exports.submitQuizAnswer = async (req, res) => {
  try {
    const { questionId, answer } = req.body;
    const interview = await Interview.findById(req.params.id)
      .populate("recruiter candidate", "name email role")
      .populate("job");

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can submit quiz answers" });
    }

    const candidateId = getParticipantId(interview.candidate);
    if (candidateId !== req.user.id) {
      return res.status(403).json({ message: "You can only answer your own interview quiz" });
    }

    if (!interview.quiz || interview.quiz.status !== "in_progress") {
      return res.status(400).json({ message: "Quiz is not currently active" });
    }

    const question = (interview.quiz.questions || []).find((q) => q.questionId === questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const trimmedAnswer = String(answer || "").trim();
    if (!trimmedAnswer) {
      return res.status(400).json({ message: "Answer cannot be empty" });
    }

    const existingIndex = (interview.quiz.answers || []).findIndex((a) => a.questionId === questionId);
    const isCorrect = String(trimmedAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase();

    if (existingIndex >= 0) {
      interview.quiz.answers[existingIndex] = {
        questionId,
        answer: trimmedAnswer,
        isCorrect,
        submittedAt: new Date(),
      };
    } else {
      interview.quiz.answers.push({
        questionId,
        answer: trimmedAnswer,
        isCorrect,
        submittedAt: new Date(),
      });
    }

    interview.quiz.score = computeQuizScore(interview.quiz.answers, interview.quiz.questions.length);
    await interview.save();

    emitQuizEvent(interview._id.toString(), "quiz:answer-submitted", {
      questionId,
      answer: trimmedAnswer,
      candidateName: interview.candidate.name,
      submittedAt: new Date().toISOString(),
    });

    emitQuizEvent(interview._id.toString(), "quiz:progress-updated", {
      totalQuestions: interview.quiz.questions.length,
      answeredCount: interview.quiz.answers.length,
      score: interview.quiz.score,
    });

    res.status(200).json({ quiz: sanitizeQuizForCandidate(interview.quiz) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> COMPLETE QUIZ
exports.completeQuiz = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate("recruiter candidate", "name email role")
      .populate("job");

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (req.user.role !== "recruiter" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only recruiters can complete quizzes" });
    }

    const recruiterId = getParticipantId(interview.recruiter);
    if (req.user.role === "recruiter" && recruiterId !== req.user.id) {
      return res.status(403).json({ message: "You can only complete your own interview quiz" });
    }

    if (!interview.quiz || interview.quiz.status !== "in_progress") {
      return res.status(400).json({ message: "Quiz is not currently in progress" });
    }

    interview.quiz.status = "completed";
    interview.quiz.completedAt = new Date();
    interview.quiz.score = computeQuizScore(interview.quiz.answers, interview.quiz.questions.length);
    await interview.save();

    const resultData = {
      interview: interview._id,
      recruiter: interview.recruiter._id || interview.recruiter,
      candidate: interview.candidate._id || interview.candidate,
      job: interview.job?._id || interview.job,
      jobTitle: interview.job?.title || "",
      jobPosition: interview.job?.position || "",
      status: interview.quiz.status,
      generatedAt: interview.quiz.generatedAt,
      startedAt: interview.quiz.startedAt,
      completedAt: interview.quiz.completedAt,
      score: interview.quiz.score,
      totalQuestions: interview.quiz.questions.length,
      answeredCount: interview.quiz.answers.length,
      passed: interview.quiz.score >= 50,
      summary: `Candidate answered ${interview.quiz.answers.length} of ${interview.quiz.questions.length} questions and scored ${interview.quiz.score}%.`,
      questions: interview.quiz.questions.map((q) => ({
        questionId: q.questionId,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "",
      })),
      answers: interview.quiz.answers.map((a) => ({
        questionId: a.questionId,
        answer: a.answer,
        isCorrect: a.isCorrect,
        submittedAt: a.submittedAt,
      })),
    };

    await QuizResult.findOneAndUpdate(
      { interview: interview._id },
      { $set: resultData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    emitQuizEvent(interview._id.toString(), "quiz:completed", {
      totalQuestions: interview.quiz.questions.length,
      answeredCount: interview.quiz.answers.length,
      score: interview.quiz.score,
    });

    const candidateId = resultData.candidate;
    const io = getIO();
    if (io) {
      io.to(`user-${candidateId}`).emit("interview:updated", {
        _id: interview._id,
        status: interview.status,
      });
    }
    createNotification({
      recipient: candidateId,
      type: "quiz_completed",
      title: "Quiz completed",
      message: `Your quiz for ${resultData.jobTitle || "the role"} scored ${interview.quiz.score}%`,
      link: `/interview/${interview._id}`,
      relatedId: interview._id,
    }).catch((err) => console.error("[Notification] quiz_completed failed:", err.message));

    res.status(200).json({ quiz: interview.quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> UPDATE OWN INTERVIEW
exports.updateInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (req.user.role !== "recruiter") {
      return res.status(403).json({ message: "Only recruiters can update interviews" });
    }

    const recruiterId = getParticipantId(interview.recruiter);
    if (recruiterId !== req.user.id) {
      return res.status(403).json({ message: "You can only update your own interviews" });
    }

    const { title, candidate, scheduledAt, status } = req.body;

    interview.title = title || interview.title;
    interview.candidate = candidate || interview.candidate;
    interview.scheduledAt = scheduledAt || interview.scheduledAt;
    interview.status = status || interview.status;

    const updatedInterview = await interview.save();
    await syncRescheduledEvent(updatedInterview);

    res.status(200).json(updatedInterview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER -> DELETE OWN INTERVIEW
exports.deleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (req.user.role !== "recruiter") {
      return res.status(403).json({ message: "Only recruiters can delete interviews" });
    }

    const recruiterId = getParticipantId(interview.recruiter);
    if (recruiterId !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own interviews" });
    }

    await syncCancelledEvent(interview); // before deleteOne: needs the event id
    await interview.deleteOne();
    await restoreApplicationToPending(interview);

    res.status(200).json({ message: "Interview deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> GET ALL INTERVIEWS
exports.adminGetInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find().populate(
      "recruiter candidate",
      "name email role"
    ).populate("job");

    res.status(200).json(interviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> GET ALL QUIZ RESULTS
exports.adminGetQuizResults = async (req, res) => {
  try {
    const quizResults = await QuizResult.find()
      .populate("recruiter candidate job", "name email role title position")
      .populate("interview", "title recruiter candidate");

    res.status(200).json(quizResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> GET SINGLE QUIZ RESULT BY ID
exports.adminGetQuizResultById = async (req, res) => {
  try {
    const quizResult = await QuizResult.findById(req.params.id)
      .populate("recruiter candidate job", "name email role title position")
      .populate("interview", "title recruiter candidate");

    if (!quizResult) {
      return res.status(404).json({ message: "Quiz result not found" });
    }

    res.status(200).json(quizResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RECRUITER/CANDIDATE/ADMIN -> GET QUIZ RESULTS
exports.getQuizResults = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "recruiter") {
      filter.recruiter = req.user.id;
    } else if (req.user.role === "candidate") {
      filter.candidate = req.user.id;
    }

    const quizResults = await QuizResult.find(filter)
      .populate("recruiter candidate job", "name email role title position")
      .populate("interview", "title recruiter candidate");

    res.status(200).json(quizResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> CREATE INTERVIEW WITH RECRUITER + CANDIDATE
exports.adminCreateInterview = async (req, res) => {
  try {
const { title, job, recruiter, candidate, scheduledAt, status } = req.body;
    const interview = await Interview.create({
      title,
      job,
      recruiter,
      candidate,
      scheduledAt,
      status: status || "pending",
    });

    res.status(201).json(interview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> UPDATE ANY INTERVIEW
exports.adminUpdateInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const { title, recruiter, candidate, scheduledAt, status } = req.body;

    interview.title = title || interview.title;
    interview.recruiter = recruiter || interview.recruiter;
    interview.candidate = candidate || interview.candidate;
    interview.scheduledAt = scheduledAt || interview.scheduledAt;
    interview.status = status || interview.status;

    const updatedInterview = await interview.save();
    await syncRescheduledEvent(updatedInterview);

    res.status(200).json(updatedInterview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN -> DELETE ANY INTERVIEW
exports.adminDeleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    await syncCancelledEvent(interview); // before deleteOne: needs the event id
    await interview.deleteOne();
    await restoreApplicationToPending(interview);

    res.status(200).json({ message: "Interview deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CANDIDATE/RECRUITER -> GENERATE AI PREP TIPS FOR AN INTERVIEW
exports.generatePrepTips = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id).populate("job");

    if (!interview) return res.status(404).json({ message: "Interview not found" });

    // only participants can request tips
    const uid = (req.user._id || req.user.id || "").toString();
    const isParticipant =
      interview.recruiter?.toString() === uid ||
      interview.candidate?.toString() === uid ||
      req.user.role === "admin";
    if (!isParticipant) return res.status(403).json({ message: "Access denied." });

    const tips = await ollamaService.generatePrepTips(interview.job, interview.title);

    if (!tips) {
      return res.status(503).json({ message: "AI service unavailable. Make sure Ollama is running." });
    }

    res.json({ tips });
  } catch (error) {
    console.error("[PrepTips] Controller error:", error);
    res.status(500).json({ error: error.message });
  }
};
