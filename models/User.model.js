const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: [true, 'Name is required'], trim: true },
    email:        { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password:     { type: String, required: [true, 'Password is required'], minlength: 6 },
    role:         { type: String, enum: ['student', 'admin'], default: 'student' },

    // Profile fields
    phone:        { type: String, default: '' },
    profileImage: { type: String, default: '' },
    cnic:         { type: String, default: '' },
    gender:       { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
    dob:          { type: String, default: '' },   // stored as 'YYYY-MM-DD' string
    country:      { type: String, default: '' },
    city:         { type: String, default: '' },

    // Student-specific
    rollNumber:   { type: String, default: '' },
    department:   { type: String, default: '' },
    batchester:   { type: String, default: '' },
    qualification:{ type: String, default: '' },
    cv:           { type: String, default: '' },  // uploaded CV filename

    // Status
    isBlocked: { type: Boolean, default: false },

    // Forgot password
    resetPasswordToken:   { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
