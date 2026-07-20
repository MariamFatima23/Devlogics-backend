const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema(
  {
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName:  { type: String, required: true },
    studentEmail: { type: String },
    studentImage: { type: String },       // uploaded photo
    courseType:   { type: String, default: 'Course' }, // Course / Internship
    courseName:   { type: String },
    description:  { type: String, required: true },
    rating:       { type: Number, min: 1, max: 5, default: 5 },
    isApproved:   { type: Boolean, default: false }, // admin approves before showing
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Review', reviewSchema)
