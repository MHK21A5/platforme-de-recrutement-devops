require("dotenv").config();

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const http = require("http");
const { Server } = require("socket.io");

const { connectToMondoDB } = require("./config/db");
const indexRouter = require("./routes/index");
const initSocket = require("./socket/socketHandler");
const { setIO } = require("./socket/socketIO");

const app = express();
const jobRoutes = require("./routes/jobs");

const applicationRoutes = require("./routes/applications");
const notificationRoutes = require("./routes/notifications");
const googleAuthRoutes = require("./routes/googleAuthRoutes");


const cors = require("cors");
const allowedOrigins = ["http://localhost:5173", "http://localhost:8081"];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));



// middlewares
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// routes
app.use("/api", indexRouter);
app.use("/uploads", express.static("uploads"));
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/google", googleAuthRoutes);

// catch 404
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message || "Server error",
  });
});

const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
initSocket(io);
setIO(io);

connectToMondoDB();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`server is running on http://localhost:${PORT}`);
});

module.exports = app;
