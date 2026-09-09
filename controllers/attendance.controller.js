const Attendance = require('../models/Attendance.model');
const User       = require('../models/User.model');

// ── Helper: get today's date at midnight (UTC) ─────────────────────
const todayMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// ── Helper: day name from date ─────────────────────────────────────
const getDayName = (date) =>
  date.toLocaleDateString('en-US', { weekday: 'long' });

/* ─────────────────────────────────────────────────────────────────
   POST /api/attendance/checkin
   Auto-called on login OR manually by team_member.
   Creates today's attendance record if it doesn't exist.
───────────────────────────────────────────────────────────────── */
const checkIn = async (req, res) => {
  try {
    const today = todayMidnight();
    const existing = await Attendance.findOne({ userId: req.user.id, date: today });

    if (existing) {
      return res.status(200).json({ message: 'Already checked in today', attendance: existing });
    }

    const attendance = await Attendance.create({
      userId:  req.user.id,
      date:    today,
      day:     getDayName(new Date()),
      checkIn: new Date(),
    });

    res.status(201).json({ message: 'Check-in recorded', attendance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/attendance/checkout
   Body: { description, taskDone, nextTask }
───────────────────────────────────────────────────────────────── */
const checkOut = async (req, res) => {
  try {
    const { description, taskDone, nextTask } = req.body;
    const today = todayMidnight();

    const attendance = await Attendance.findOne({ userId: req.user.id, date: today });
    if (!attendance) {
      return res.status(404).json({ message: 'Aaj check-in record nahi mila. Pehle check-in karein.' });
    }
    if (attendance.checkOut) {
      return res.status(400).json({ message: 'Aap aaj pehle hi check-out kar chuke hain.' });
    }

    // Close any open break automatically
    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    if (lastBreak && !lastBreak.breakEnd) {
      lastBreak.breakEnd = new Date();
    }

    attendance.checkOut    = new Date();
    attendance.description = description || '';
    attendance.taskDone    = taskDone    || '';
    attendance.nextTask    = nextTask    || '';
    await attendance.save();

    res.json({ message: 'Check-out successful', attendance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/attendance/break/start
───────────────────────────────────────────────────────────────── */
const startBreak = async (req, res) => {
  try {
    const today = todayMidnight();
    const attendance = await Attendance.findOne({ userId: req.user.id, date: today });

    if (!attendance) {
      return res.status(404).json({ message: 'Aaj check-in nahi hua.' });
    }
    if (attendance.checkOut) {
      return res.status(400).json({ message: 'Aap check-out kar chuke hain, break nahi le sakte.' });
    }

    // Check if a break is already open
    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    if (lastBreak && !lastBreak.breakEnd) {
      return res.status(400).json({ message: 'Ek break pehle se chal rahi hai. Pehle end karein.' });
    }

    attendance.breaks.push({ breakStart: new Date() });
    await attendance.save();

    res.json({ message: 'Break shuru ho gayi', attendance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/attendance/break/end
───────────────────────────────────────────────────────────────── */
const endBreak = async (req, res) => {
  try {
    const today = todayMidnight();
    const attendance = await Attendance.findOne({ userId: req.user.id, date: today });

    if (!attendance) {
      return res.status(404).json({ message: 'Aaj check-in nahi hua.' });
    }

    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    if (!lastBreak || lastBreak.breakEnd) {
      return res.status(400).json({ message: 'Koi active break nahi hai.' });
    }

    lastBreak.breakEnd = new Date();
    await attendance.save();

    res.json({ message: 'Break khatam', attendance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/attendance/today
   Returns today's record for the logged-in user
───────────────────────────────────────────────────────────────── */
const getToday = async (req, res) => {
  try {
    const today = todayMidnight();
    const attendance = await Attendance.findOne({ userId: req.user.id, date: today });
    res.json({ attendance: attendance || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/attendance/my?month=2026-09
   Returns all attendance records for the logged-in user.
   Optional query: ?month=YYYY-MM  filters to that month.
───────────────────────────────────────────────────────────────── */
const getMyAttendance = async (req, res) => {
  try {
    const { month } = req.query; // e.g. "2026-09"
    const query = { userId: req.user.id };

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const start = new Date(year, mon - 1, 1);
      const end   = new Date(year, mon, 1);
      query.date  = { $gte: start, $lt: end };
    }

    const records = await Attendance.find(query).sort({ date: -1 });
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/attendance/all?month=2026-09&userId=xxx   (Admin only)
   Returns attendance for all team members or a specific user.
───────────────────────────────────────────────────────────────── */
const getAllAttendance = async (req, res) => {
  try {
    const { month, userId } = req.query;
    const query = {};

    if (userId) query.userId = userId;

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const start = new Date(year, mon - 1, 1);
      const end   = new Date(year, mon, 1);
      query.date  = { $gte: start, $lt: end };
    }

    const records = await Attendance
      .find(query)
      .populate('userId', 'name email profileImage role')
      .sort({ date: -1 });

    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/users/:id/reset-device   (Admin only — in user routes)
   Clears deviceId so the user can log in from a new device.
───────────────────────────────────────────────────────────────── */
const resetDevice = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { deviceId: null },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `${user.name} ki device reset ho gayi. Ab wo naye device se login kar sakta/sakti hai.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getToday,
  getMyAttendance,
  getAllAttendance,
  resetDevice,
};
