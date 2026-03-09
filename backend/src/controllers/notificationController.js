const Notification = require("../models/Notification");

/**
 * @desc   Get all notifications for current user
 * @route  GET /api/notifications
 * @access Private
 */
const getNotifications = async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const query = { userId: req.user._id };
  if (unreadOnly === "true") query.read = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

/**
 * @desc   Mark single notification as read
 * @route  PUT /api/notifications/:id/read
 * @access Private
 */
const markAsRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found." });
  }

  res.status(200).json({ success: true, data: { notification } });
};

/**
 * @desc   Mark all notifications as read
 * @route  PUT /api/notifications/read-all
 * @access Private
 */
const markAllAsRead = async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user._id, read: false },
    { read: true }
  );

  res.status(200).json({
    success: true,
    message: `Marked ${result.modifiedCount} notifications as read.`,
  });
};

/**
 * @desc   Delete all notifications for user
 * @route  DELETE /api/notifications
 * @access Private
 */
const clearNotifications = async (req, res) => {
  await Notification.deleteMany({ userId: req.user._id });
  res.status(200).json({ success: true, message: "All notifications cleared." });
};

/**
 * @desc   Delete single notification
 * @route  DELETE /api/notifications/:id
 * @access Private
 */
const deleteNotification = async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found." });
  }

  res.status(200).json({ success: true, message: "Notification deleted." });
};

module.exports = { getNotifications, markAsRead, markAllAsRead, clearNotifications, deleteNotification };
