const jwt = require("jsonwebtoken");
const Interview = require("../models/Interview");

const roomMessages = {};
const roomPresence = {};
const socketRoomMap = {};

function getPresenceList(room) {
  if (!roomPresence[room]) return [];

  const seen = new Set();
  const list = [];

  for (const info of roomPresence[room].values()) {
    if (!seen.has(info.userId)) {
      seen.add(info.userId);
      list.push({
        userId: info.userId,
        userName: info.userName,
        role: info.role,
      });
    }
  }

  return list;
}

function broadcastPresence(io, room) {
  io.to(room).emit("presence-update", getPresenceList(room));
}

function getLiveRoomsStatus() {
  const status = {};

  for (const room of Object.keys(roomPresence)) {
    const interviewId = room.replace("interview-", "");
    status[interviewId] = roomPresence[room]?.size > 0;
  }

  return status;
}

function broadcastLiveStatus(io) {
  io.emit("rooms-live-status", getLiveRoomsStatus());
}

async function updateInterviewStatusIfReady(room, io) {
  const users = Array.from(roomPresence[room]?.values() || []);

  const hasRecruiter = users.some((u) => u.role === "recruiter");
  const hasCandidate = users.some((u) => u.role === "candidate");

  if (!hasRecruiter || !hasCandidate) return;

  const interviewId = room.replace("interview-", "");

  try {
    const interview = await Interview.findById(interviewId);

    if (interview && interview.status === "pending") {
      interview.status = "ongoing";
      await interview.save();

      io.to(room).emit("interview-status-updated", "ongoing");
      console.log(`[socket] Interview ${interviewId} → ONGOING`);
    }
  } catch (err) {
    console.error("Error updating interview status:", err);
  }
}

module.exports = function initSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected id=${socket.id} user=${socket.user?.id}`);

    socket.join(`user-${socket.user.id}`);
    socket.join(`role-${socket.user.role}`);

    socket.emit("rooms-live-status", getLiveRoomsStatus());

    socket.on("join-room", async ({ interviewId, userName }) => {
      const room = `interview-${interviewId}`;

      socket.join(room);
      socket.currentRoom = room;
      socketRoomMap[socket.id] = room;
      socket.userName = userName || "Unknown";

      if (!roomMessages[room]) roomMessages[room] = [];
      if (!roomPresence[room]) roomPresence[room] = new Map();

      roomPresence[room].set(socket.id, {
        userId: socket.user.id,
        userName: socket.userName,
        role: socket.user.role,
      });

      socket.emit("message-history", roomMessages[room]);

      socket.to(room).emit("user-joined", {
        userId: socket.user.id,
        userName: socket.userName,
        timestamp: new Date().toISOString(),
      });

      await updateInterviewStatusIfReady(room, io);

      broadcastPresence(io, room);
      broadcastLiveStatus(io);

      console.log(`[socket] ${socket.userName} joined ${room}`);
    });

    socket.on("send-message", ({ interviewId, text }) => {
      const room = `interview-${interviewId}`;
      const trimmed = (text || "").trim();

      if (!trimmed) return;

      const message = {
        id: `${socket.user.id}-${Date.now()}`,
        text: trimmed,
        sender: {
          id: socket.user.id,
          name: socket.userName || "Unknown",
          role: socket.user.role,
        },
        timestamp: new Date().toISOString(),
      };

      if (!roomMessages[room]) roomMessages[room] = [];

      roomMessages[room].push(message);

      if (roomMessages[room].length > 200) {
        roomMessages[room].shift();
      }

      io.to(room).emit("message", message);
    });

    // ── WebRTC signaling ────────────────────────────────────────────────────
    socket.on("webrtc-call-request", ({ interviewId }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("webrtc-call-request", { from: socket.user.id, fromName: socket.userName });
      console.log(`[webrtc] call-request from ${socket.userName} in ${room}`);
    });

    socket.on("webrtc-call-accept", ({ interviewId }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("webrtc-call-accept", { from: socket.user.id });
    });

    socket.on("webrtc-call-reject", ({ interviewId }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("webrtc-call-reject", { from: socket.user.id });
    });

    socket.on("webrtc-offer", ({ interviewId, offer }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("webrtc-offer", { offer, from: socket.user.id });
    });

    socket.on("webrtc-answer", ({ interviewId, answer }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("webrtc-answer", { answer, from: socket.user.id });
    });

    socket.on("webrtc-ice-candidate", ({ interviewId, candidate }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("webrtc-ice-candidate", { candidate, from: socket.user.id });
    });

    socket.on("webrtc-call-end", ({ interviewId }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("webrtc-call-end", { from: socket.user.id });
      console.log(`[webrtc] call-end from ${socket.userName} in ${room}`);
    });

    socket.on("candidate-tab-hidden", ({ interviewId }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("candidate-tab-hidden", {
        userId: socket.user.id,
        userName: socket.userName,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("candidate-tab-visible", ({ interviewId }) => {
      const room = `interview-${interviewId}`;
      socket.to(room).emit("candidate-tab-visible", {
        userId: socket.user.id,
        userName: socket.userName,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const room = socketRoomMap[socket.id];

      if (room && roomPresence[room]) {
        roomPresence[room].delete(socket.id);
        delete socketRoomMap[socket.id];

        if (roomPresence[room].size > 0) {
          broadcastPresence(io, room);
        } else {
          delete roomPresence[room];
          delete roomMessages[room];
        }

        broadcastLiveStatus(io);

        socket.to(room).emit("user-left", {
          userId: socket.user?.id,
          userName: socket.userName,
          timestamp: new Date().toISOString(),
        });

        // If the disconnecting user was in a call, notify the other side
        socket.to(room).emit("webrtc-call-end", { from: socket.user?.id });
      }

      console.log(`[socket] disconnected id=${socket.id} user=${socket.user?.id}`);
    });
  });
};