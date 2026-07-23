const User   = require('../models/User.model');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { sendResetEmail } = require('../utils/email');

const generateToken = (user) =>
  jwt.sign(
    {
      id: user._id, role: user.role, name: user.name, email: user.email,
      phone: user.phone, rollNumber: user.rollNumber,
      department: user.department, batchester: user.batchester,
      profileImage: user.profileImage, cnic: user.cnic,
      gender: user.gender, dob: user.dob,
      country: user.country, city: user.city,
      qualification: user.qualification, cv: user.cv,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

/* ── Register ─────────────────────────── */
const register = async (req, res) => {
  try {
    const { name, email, password, rollNumber, department, batchester, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, rollNumber, department, batchester, phone });
    const token = generateToken(user);

    // Notify admins
    try {
      const { notifyAdmins } = require('../routes/notification.routes');
      await notifyAdmins('new_student', '👤 New Student Registered', `${name} (${email}) just created an account.`);
    } catch {}

    res.status(201).json({
      message: 'Registered successfully',
      token,
      user: {
        id: user._id, name: user.name, email: user.email,
        role: user.role, rollNumber: user.rollNumber,
        department: user.department, batchester: user.batchester,
        phone: user.phone, cnic: user.cnic,
        gender: user.gender, dob: user.dob,
        country: user.country, city: user.city,
        profileImage: user.profileImage,
        qualification: user.qualification,
        cv: user.cv,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── Login ─────────────────────────── */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });
    if (user.isBlocked) return res.status(403).json({ message: 'Your account has been blocked. Contact admin.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id, name: user.name, email: user.email,
        role: user.role, rollNumber: user.rollNumber,
        department: user.department, batchester: user.batchester,
        phone: user.phone, cnic: user.cnic,
        gender: user.gender, dob: user.dob,
        country: user.country, city: user.city,
        profileImage: user.profileImage,
        qualification: user.qualification,
        cv: user.cv,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── Forgot Password — send reset email ─────────────────────────── */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

    // Always return same message to prevent email enumeration
    const okMsg = 'If that email is registered, a reset link has been sent.';
    if (!user) return res.json({ message: okMsg });

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken   = token;
    user.resetPasswordExpires = expires;
    await user.save();

    await sendResetEmail(user.email, token, user.name);

    res.json({ message: okMsg });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ message: 'Failed to send reset email. Try again later.' });
  }
};

/* ── Reset Password — verify token + set new password ─────────────────────────── */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: 'Reset link is invalid or has expired.' });

    user.password             = await bcrypt.hash(password, 10);
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── Change Password (logged-in user) ─────────────────────────── */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, forgotPassword, resetPassword, changePassword };
