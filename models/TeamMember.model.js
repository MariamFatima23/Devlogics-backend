const mongoose = require('mongoose')

const teamMemberSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    email:   { type: String, trim: true, default: '' },
    phone:   { type: String, default: '' },
    role: {
      type: String,
      enum: ['Sales', 'Marketing', 'Counselor', 'Manager', 'Support', 'Other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // linked login account
  },
  { timestamps: true }
)

module.exports = mongoose.model('TeamMember', teamMemberSchema)
