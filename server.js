const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app = express();

// ── CORS ────────────────────────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true)
    if (
      origin.includes('vercel.app') ||
      origin.includes('localhost')
    ) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json())

// ── /uploads handler ─────────────────────────────────────────────
// On Vercel (production) there is no local disk — files go to Cloudinary.
// If a stored URL is a full Cloudinary URL (old records may have been saved
// as just the filename, or the full URL was stored and the frontend accidentally
// prepended /uploads/).  This handler catches both cases:
//   • /uploads/https:/res.cloudinary.com/... → redirect to the real Cloudinary URL
//   • /uploads/<filename>                    → 302 to Cloudinary lookup (local dev only)
app.use('/uploads', (req, res, next) => {
  // req.path starts with '/', e.g. '/https:/res.cloudinary.com/...' or '/abc.png'
  const raw = req.path.slice(1); // strip leading slash

  // Case 1: the path itself IS a full URL (frontend accidentally prefixed it)
  // It looks like "https:/res.cloudinary.com/..." (one slash due to URL normalisation)
  // or "https://res.cloudinary.com/..."
  if (raw.startsWith('https:/') || raw.startsWith('http:/')) {
    // Reconstruct the proper double-slash URL
    const fixed = raw.replace(/^https?:\/?\//, (m) => {
      // ensure exactly two slashes
      return m.startsWith('https') ? 'https://' : 'http://';
    });
    return res.redirect(301, fixed);
  }

  // Case 2: local dev — serve from disk
  if (!process.env.VERCEL) {
    return next(); // fall through to express.static below
  }

  // Case 3: Vercel production + plain filename — nothing we can do, 404
  return res.status(404).json({ message: 'File not found. Files are served from Cloudinary.' });
});

if (!process.env.VERCEL) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// ── MongoDB connection ───────────────────────────────────────────
async function connectDB() {
  if (mongoose.connection.readyState === 1) return;  // already connected
  if (mongoose.connection.readyState === 2) {         // connecting
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
    });
    return;
  }
  // fresh connect
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 15000,
    maxPoolSize: 5,
  });
  console.log('✅ MongoDB connected');
}

// ── DB middleware — MUST be before routes ────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    res.status(500).json({ message: 'Database connection failed', detail: err.message });
  }
});

// ── Health check ─────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: 'University E-Portal API running' }));

// ── Debug env (remove after fixing) ─────────────────────────────
app.get('/api/debug-env', (req, res) => {
  res.json({
    MONGO_URI_exists: !!process.env.MONGO_URI,
    MONGO_URI_start: process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 30) : 'NOT SET',
    JWT_SECRET_exists: !!process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    mongoose_state: mongoose.connection.readyState,
  });
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth',                require('./routes/auth.routes'))
app.use('/api/users',               require('./routes/user.routes'))
app.use('/api/applications',        require('./routes/application.routes'))
app.use('/api/notifications',       require('./routes/notification.routes'))
app.use('/api/announcements',       require('./routes/announcement.routes'))
app.use('/api/courses',             require('./routes/course.routes'))
app.use('/api/services',            require('./routes/service.routes'))
app.use('/api/hero-slides',         require('./routes/heroslide.routes'))
app.use('/api/course-applications', require('./routes/courseApplication.routes'))
app.use('/api/reviews',             require('./routes/review.routes'))
app.use('/api/student-pride',       require('./routes/studentPride.routes'))
app.use('/api/site-settings',       require('./routes/siteSettings.routes'))
app.use('/api/contact',             require('./routes/contact.routes'))

// ── Local dev server ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  }).catch((err) => console.error('❌ MongoDB error:', err));
}

module.exports = app;
