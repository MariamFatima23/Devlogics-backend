const express = require('express');
const router  = express.Router();
const { protect, adminOnly, crmAccess } = require('../middleware/auth.middleware');

// Sirf student role allowed (not team_member)
const studentOnly = (req, res, next) => {
  if (['admin', 'student'].includes(req.user?.role)) return next();
  return res.status(403).json({ message: 'Student attendance access only' });
};

const {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getToday,
  getMyAttendance,
  getAllAttendance,
} = require('../controllers/attendance.controller');

// ── Student-only routes ───────────────────────────────────────────
router.post('/checkin',      protect, studentOnly, checkIn);
router.post('/checkout',     protect, studentOnly, checkOut);
router.post('/break/start',  protect, studentOnly, startBreak);
router.post('/break/end',    protect, studentOnly, endBreak);
router.get('/today',         protect, studentOnly, getToday);
router.get('/my',            protect, studentOnly, getMyAttendance);

// ── Admin-only routes ─────────────────────────────────────────────
router.get('/all',           protect, adminOnly, getAllAttendance);

module.exports = router;
