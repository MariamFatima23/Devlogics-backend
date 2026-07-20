const mongoose = require('mongoose')

const serviceSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true },
    icon:        { type: String, default: '📋' },
    tag:         { type: String, default: 'Service' },
    bgFrom:      { type: String, default: '#03045e' },
    bgTo:        { type: String, default: '#0077b6' },
    accent:      { type: String, default: '#48cae4' },
    isActive:    { type: Boolean, default: true },
    order:       { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Service', serviceSchema)
