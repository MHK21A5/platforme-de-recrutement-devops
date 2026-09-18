const Notification = require("../models/Notification");
const Application = require("../models/Application");
const Interview = require("../models/Interview");

const pairKey = (job, candidate) => `${job}-${candidate}`;

/**
 * Adds the derived `canCreateInterview` flag to notifications. It is NOT stored:
 * it is recomputed on read so the action disappears as soon as it stops making
 * sense (application processed, or an interview already exists).
 *
 * Only "application_new" qualifies — it is the sole type whose recipient is the
 * recruiter. Costs 2 extra queries in total, not one per notification.
 */
async function withCreateInterviewFlag(notifications, user) {
  const withFlag = (n, value = false) => ({ ...n, canCreateInterview: value });

  if (user.role !== "recruiter" && user.role !== "admin") {
    return notifications.map((n) => withFlag(n));
  }

  const applicationIds = notifications
    .filter((n) => n.type === "application_new" && n.relatedId)
    .map((n) => n.relatedId);

  if (!applicationIds.length) return notifications.map((n) => withFlag(n));

  const applications = await Application.find({
    _id: { $in: applicationIds },
    status: "pending",
  })
    .select("job candidate")
    .lean();

  if (!applications.length) return notifications.map((n) => withFlag(n));

  const interviews = await Interview.find({
    $or: applications.map((a) => ({ job: a.job, candidate: a.candidate })),
  })
    .select("job candidate")
    .lean();

  const alreadyScheduled = new Set(interviews.map((i) => pairKey(i.job, i.candidate)));
  const actionable = new Set(
    applications
      .filter((a) => !alreadyScheduled.has(pairKey(a.job, a.candidate)))
      .map((a) => a._id.toString())
  );

  return notifications.map((n) =>
    withFlag(n, n.type === "application_new" && n.relatedId
      ? actionable.has(n.relatedId.toString())
      : false)
  );
}

exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      read: false,
    });

    res.status(200).json({
      notifications: await withCreateInterviewFlag(notifications, req.user),
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true }
    );

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
