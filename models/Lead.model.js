const mongoose = require('mongoose')

const leadSchema = new mongoose.Schema(
  {
    clientName:  { type: String, required: true, trim: true },
    contact:     { type: String, required: true, trim: true },
    email:       { type: String, trim: true, default: '' },
    source:      {
      type: String,
      enum: ['Facebook', 'Instagram', 'Website', 'Referral', 'Walk-in', 'WhatsApp', 'LinkedIn', 'Other'],
      required: true,
    },
    purpose:     { type: String, required: true, trim: true }, // e.g. "Interested in Web Dev course"
    notes:       { type: String, default: '' },

    // Grade: Diamond / Silver / Bronze
    grade: {
      type: String,
      enum: ['Diamond', 'Silver', 'Bronze', 'Ungraded'],
      default: 'Ungraded',
    },

    // Overall lead status
    status: {
      type: String,
      enum: ['New', 'Assigned', 'In Progress', 'Converted', 'Lost'],
      default: 'New',
    },

    // Who created this lead (admin)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Lead', leadSchema)
