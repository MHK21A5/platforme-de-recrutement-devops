const mongoose = require("mongoose");

const quizResultSchema = new mongoose.Schema(
  {
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
      unique: true,
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    jobTitle: {
      type: String,
      default: "",
    },
    jobPosition: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["ready", "in_progress", "completed"],
      default: "ready",
    },
    generatedAt: Date,
    startedAt: Date,
    completedAt: Date,
    score: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    answeredCount: {
      type: Number,
      default: 0,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    summary: {
      type: String,
      default: "",
    },
    questions: [
      {
        questionId: { type: String, required: true },
        prompt: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: String, required: true },
        explanation: { type: String, default: "" },
      },
    ],
    answers: [
      {
        questionId: { type: String, required: true },
        answer: { type: String, required: true },
        isCorrect: { type: Boolean, required: true },
        submittedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizResult", quizResultSchema);
