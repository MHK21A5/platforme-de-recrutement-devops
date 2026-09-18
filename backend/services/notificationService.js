const Notification = require("../models/Notification");
const { getIO } = require("../socket/socketIO");

async function createNotification({ recipient, type, title, message, link, relatedId }) {
  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    link,
    relatedId,
  });

  const io = getIO();
  if (io) {
    // A freshly created "application_new" is always actionable: the application
    // was just created as "pending", so no interview can exist yet. The flag is
    // derived (never stored) and is recomputed on every GET /notifications.
    io.to(`user-${recipient}`).emit("notification:new", {
      ...notification.toObject(),
      canCreateInterview: type === "application_new",
    });
  }

  return notification;
}

module.exports = { createNotification };
