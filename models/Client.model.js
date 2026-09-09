const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name:    { type: String, required: [true, 'Client name is required'], trim: true },
    email:   { type: String, trim: true, lowercase: true, default: '' },
    phone:   { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    notes:   { type: String, trim: true, default: '' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
