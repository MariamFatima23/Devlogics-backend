const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    // Application Type
    type: {
      type: String,
      required: true,
      enum: [
        'Fee Concession',
        'Scholarship',
        'Character Certificate',
        'Hostel Allocation',
        'Transcript Request',
        'Complaint'
      ],
    },
    
    // Student Info
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentName: String,
    studentEmail: String,
    rollNumber: String,
    department: String,
    batchester: String,
    
    // Application Details
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    
    // File Upload
    attachments: [{
      originalName: String,
      fileName: String,
      filePath: String,
      fileSize: Number,
      mimeType: String,
    }],
    
    // Status & Timeline
    status: {
      type: String,
      enum: ['Pending', 'Under Review', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    
    timeline: [{
      status: String,
      comment: String,
      updatedBy: String,
      updatedAt: { type: Date, default: Date.now },
    }],
    
    // Admin Response
    adminComment: String,
    rejectionReason: String,
    reviewedBy: String,
    reviewedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Application', applicationSchema);
