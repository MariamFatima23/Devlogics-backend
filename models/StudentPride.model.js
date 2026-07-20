const mongoose = require('mongoose')

const studentPrideSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    role:        { type: String, default: '' },          // e.g. "Web Developer"
    courseType:  { type: String, default: 'Course' },    // Course / Internship
    courseName:  { type: String, default: '' },
    badge:       { type: String, default: '' },          // e.g. "Top Student"
    quote:       { type: String, required: true },
    image:       { type: String, default: '' },          // uploaded filename
    color:       { type: String, default: 'from-blue-600 to-blue-900' }, // tailwind gradient class
    isActive:    { type: Boolean, default: true },
    order:       { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('StudentPride', studentPrideSchema)
