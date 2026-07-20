const mongoose = require('mongoose')

const announcementSchema = new mongoose.Schema(
  {
    title:    { type: String, required: true, trim: true },
    content:  { type: String, required: true },
    category: { type: String, enum: ['General', 'Exam', 'Fee', 'Holiday', 'Event', 'Urgent'], default: 'General' },
    postedBy: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Announcement', announcementSchema)
