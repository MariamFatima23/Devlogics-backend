const mongoose = require('mongoose');

const breakSchema = new mongoose.Schema(
  {
    breakStart: { type: Date, required: true },
    breakEnd:   { type: Date, default: null },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    date: {
      type:     Date,
      required: true,
    },
    day: {
      type: String, // "Monday", "Tuesday", etc.
    },
    checkIn:  { type: Date, default: null },
    checkOut: { type: Date, default: null },

    breaks: [breakSchema],

    // Filled at check-out
    description: { type: String, default: '' },
    taskDone:    { type: String, default: '' },
    nextTask:    { type: String, default: '' },
  },
  { timestamps: true }
);

// One attendance record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
