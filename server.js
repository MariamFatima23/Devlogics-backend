const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow all vercel.app domains + localhost
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

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    bufferCommands: false,
  })
  .then(() => {
    console.log('✅ MongoDB connected');
    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    }
  })
  .catch((err) => console.error('❌ MongoDB error:', err));

module.exports = app;
