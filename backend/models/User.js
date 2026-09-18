const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin","recruiter", "candidate"],
      default: "candidate",
    },

    cv: {
  type: String,
  default: null,
},

profileImage: {
  type: String,
  default: null,
},

    // ── Google Calendar (OAuth 2.0) ──────────────────────────────────────────
    // Jetons chiffrés au repos (AES-256-GCM, cf. services/tokenCrypto.js) et
    // `select: false` : ils ne sortent jamais du backend.
    googleCalendarConnected: {
      type: Boolean,
      default: false,
    },

    googleCalendarEmail: {
      type: String,
      default: null,
    },

    googleAccessToken: {
      type: String,
      default: null,
      select: false,
    },

    googleRefreshToken: {
      type: String,
      default: null,
      select: false,
    },

    googleTokenExpiry: {
      type: Date,
      default: null,
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);