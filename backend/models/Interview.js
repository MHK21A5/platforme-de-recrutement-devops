const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },


    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
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

    scheduledAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "ongoing", "finished"],
      default: "pending",
    },

    // ── Google Calendar ──────────────────────────────────────────────────────
    // Renseignés uniquement si le recruteur a connecté son Google Calendar.
    // `googleCalendarEventId` est nécessaire pour mettre à jour l'événement lors
    // d'une replanification et le supprimer lors d'une annulation.
    googleCalendarEventId: {
      type: String,
      default: null,
    },

    googleCalendarHtmlLink: {
      type: String,
      default: null,
    },

    googleCalendarSyncStatus: {
      type: String,
      enum: ["not_connected", "synced", "failed"],
      default: "not_connected",
    },

    quiz: {
      status: {
        type: String,
        enum: ["ready", "in_progress", "completed"],
        default: null,
      },
      generatedAt: {
        type: Date,
      },
      startedAt: {
        type: Date,
      },
      completedAt: {
        type: Date,
      },
      score: {
        type: Number,
        default: 0,
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Interview", interviewSchema);