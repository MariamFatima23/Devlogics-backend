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
// Cloudinary URLs stored in DB are full https:// URLs.
// If frontend accidentally prefixes them with /uploads/, we redirect.
// Also handles single-slash normalisation: "https:/res..." → "https://res..."
app.use('/uploads', (req, res, next) => {
  const raw = req.path.slice(1); // strip leading '/'

  // Detect embedded full URL — either "https://..." or "https:/..." (browser normalized)
  if (/^https?:\//.test(raw)) {
    // Ensure exactly double slash
    const fixed = raw.replace(/^(https?):\/+/, '$1://');
    return res.redirect(301, fixed);
  }

  // Local dev — serve static files from disk
  if (!process.env.VERCEL) {
    return next();
  }

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
