const express      = require('express');
const router       = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const Notification = require('../models/Notification.model');
const User         = require('../models/User.model');

/* ── Helper exported for other routes ─────────────────────────── */

// Notify a single user
const notifyUser = async (userId, type, title, message, extras = {}) => {
  try {
    await Notification.create({ userId, type, title, message, ...extras });
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

// Notify all admins
const notifyAdmins = async (type, title, message, extras = {}) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    const docs = admins.map(a => ({ userId: a._id, type, title, message, ...extras }));
    if (docs.length) await Notification.insertMany(docs);
  } catch (err) {
    console.error('Admin notification error:', err.message);
  }
};

// Notify all active students
const notifyAllStudents = async (type, title, message, extras = {}) => {
  try {
    const students = await User.find({ role: 'student', isBlocked: { $ne: true } }).select('_id');
    const docs = students.map(s => ({ userId: s._id, type, title, message, ...extras }));
    if (docs.length) await Notification.insertMany(docs);
  } catch (err) {
    console.error('Student notification error:', err.message);
  }
};

/* ── REST endpoints ─────────────────────────── */
const notifRouter = express.Router();

// Get my notifications (student or admin)
notifRouter.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get unread count
notifRouter.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark all as read
notifRouter.patch('/mark-all-read', protect, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark one as read
notifRouter.patch('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete one notification
notifRouter.delete('/:id', protect, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = notifRouter;
module.exports.notifyUser        = notifyUser;
module.exports.notifyAdmins      = notifyAdmins;
module.exports.notifyAllStudents = notifyAllStudents;
