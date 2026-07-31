const mongoose = require('mongoose')

const leadAssignmentSchema = new mongoose.Schema(
  {
    leadId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    teamMemberId:   { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
    teamMemberName: { type: String },
    assignedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedByName: { type: String },
    note:           { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('LeadAssignment', leadAssignmentSchema)
