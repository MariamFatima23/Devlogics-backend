const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}))
app.use(express.json())

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// One-time migration: fill empty arrays in SiteSettings
app.post('/api/fix-site-settings', async (req, res) => {
  const SiteSettings = require('./models/SiteSettings.model');
  try {
    let s = await SiteSettings.findOne()
    if (!s) { s = await SiteSettings.create({}); return res.json({ message: 'Created fresh settings with defaults' }) }
    let changed = false
    if (!s.partners?.length)    { s.partners    = ['Web Development','Artificial Intelligence','Digital Marketing','React Native','Python','Machine Learning','Data Science','Cybersecurity','UI/UX Design','Cloud Computing','Java','JavaScript','SEO','Graphic Design','DevOps']; changed = true }
    if (!s.howItWorks?.length)  { s.howItWorks  = [{ step:'01', icon:'user', title:'Create Account', desc:'Register and complete your profile.' },{ step:'02', icon:'submit', title:'Submit Application', desc:'Choose course, fill form, attach CV.' },{ step:'03', icon:'review', title:'Admin Review', desc:'Admin reviews and updates your status.' },{ step:'04', icon:'decision', title:'Get Decision', desc:'Receive Approved or Rejected with feedback.' }]; changed = true }
    if (!s.features?.length)    { s.features    = [{ icon:'lock', title:'Secure Login', desc:'JWT auth with encrypted passwords.' },{ icon:'mobile', title:'Mobile Friendly', desc:'Works on any device perfectly.' },{ icon:'bell', title:'Real-time Alerts', desc:'Instant notifications on status change.' },{ icon:'chart', title:'Track Applications', desc:'Full timeline for every application.' },{ icon:'upload', title:'Document Upload', desc:'Attach PDFs, images, Word docs.' },{ icon:'cogs', title:'Admin Dashboard', desc:'Powerful panel to manage everything.' }]; changed = true }
    if (!s.aboutPoints?.length) { s.aboutPoints = ['Apply online — no office visits','Upload CV and documents securely','Track every application with timeline','Real-time notifications on changes','Admin review with detailed feedback','Available 24/7 from any device']; changed = true }
    if (changed) await s.save()
    res.json({ message: changed ? 'Fixed empty arrays in SiteSettings' : 'SiteSettings already has data — no changes needed' })
  } catch (err) { res.status(500).json({ message: err.message }) }
});

// TEMPORARY: Make user admin (remove after testing)
app.post('/api/make-admin', async (req, res) => {
  const User = require('./models/User.model');
  try {
    const { email } = req.body;
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: 'admin' } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User is now admin', user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => console.error('❌ MongoDB error:', err));
