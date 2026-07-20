const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Optional references
    applicationId: { type: mongoose.Schema.Types.ObjectId },
    courseId:       { type: mongoose.Schema.Types.ObjectId },

    type: {
      type: String,
      enum: [
        // Student notifications
        'application_submitted',
        'status_updated',
        'under_review',
        'approved',
        'rejected',
        'new_course',
        'new_announcement',
        // Admin notifications
        'new_student',
        'new_review',
        'new_course_application',
        'new_general_application',
      ],
      required: true,
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    read:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
