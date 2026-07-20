const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app = express();

// Middleware
const allowedOrigins = [
  'https://devlogics-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
]

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true)
    if (
      allowedOrigins.includes(origin) ||
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

// Serve uploaded files statically (only in local development)
if (!process.env.VERCEL) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Routes
app.use('/api/auth',          require('./routes/auth.routes'))
app.use('/api/users',         require('./routes/user.routes'))
app.use('/api/applications',  require('./routes/application.routes'))
app.use('/api/notifications', require('./routes/notification.routes'))
app.use('/api/announcements', require('./routes/announcement.routes'))
app.use('/api/courses',       require('./routes/course.routes'))
app.use('/api/services',      require('./routes/service.routes'))
app.use('/api/hero-slides',        require('./routes/heroslide.routes'))
app.use('/api/course-applications', require('./routes/courseApplication.routes'))
app.use('/api/reviews',             require('./routes/review.routes'))
app.use('/api/student-pride',       require('./routes/studentPride.routes'))
app.use('/api/site-settings',       require('./routes/siteSettings.routes'))
app.use('/api/contact',             require('./routes/contact.routes'))

// Health check
app.get('/', (req, res) => res.json({ message: 'University E-Portal API running' }));

// MongoDB connection helper (cached for Vercel serverless)
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  isConnected = true;
  console.log('✅ MongoDB connected');
}

// Middleware to ensure DB is connected before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    res.status(500).json({ message: 'Database connection failed' });
  }
});

// Connect to MongoDB and start server (local dev)
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  }).catch((err) => console.error('❌ MongoDB error:', err));
}

module.exports = app;
