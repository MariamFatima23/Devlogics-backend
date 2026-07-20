const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email:    { type: String, required: true, trim: true, lowercase: true },
  course:   { type: String, default: '' },
  message:  { type: String, required: true, trim: true },
  isRead:   { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
