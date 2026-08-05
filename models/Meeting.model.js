const mongoose = require('mongoose')

const meetingSchema = new mongoose.Schema(
  {
    leadId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    leadName:     { type: String },
    leadContact:  { type: String, default: '' }, // saved for WhatsApp

    teamMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember' },
    teamMemberName: { type: String },

    meetingType: {
      type: String,
      enum: ['Online', 'Onsite'],
      required: true,
    },
    platform: {
      type: String,
      enum: ['Google Meet', 'Zoom', 'Phone Call', 'In-Person', 'Microsoft Teams', 'Other'],
      default: 'Other',
    },
    topic:        { type: String, required: true },
    meetingLink:  { type: String, default: '' }, // Zoom/Google Meet link (manually pasted)
    scheduledAt:  { type: Date, required: true },
    durationMins: { type: Number, default: 30 }, // duration in minutes

    // Status: auto set to Overdue if scheduledAt passed and still Pending
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Rescheduled', 'Cancelled', 'Overdue'],
      default: 'Pending',
    },

    rescheduleReason: { type: String, default: '' },
    rescheduledAt:    { type: Date },

    // Full reschedule history
    rescheduleHistory: [{
      previousDate:   { type: Date },
      rescheduledAt:  { type: Date, default: Date.now },
      reason:         { type: String, default: '' },
    }],

    // After meeting outcome
    outcome: {
      type: String,
      enum: ['Interested', 'Not Interested', 'Objection', 'Follow-up Required', 'Converted', 'No Show', ''],
      default: '',
    },
    outcomeNotes:   { type: String, default: '' },
    nextActionDate: { type: Date },

    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Meeting', meetingSchema)
