const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const Announcement = require('../models/Announcement.model');

// Get all active announcements
router.get('/', async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true }).sort({ createdAt: -1 }).limit(10);
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create announcement (admin)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const announcement = await Announcement.create({ title, content, category, postedBy: req.user.name });

    // Notify all active students
    const { notifyAllStudents } = require('./notification.routes')
    await notifyAllStudents(
      'new_announcement',
      `📢 New Announcement: ${title}`,
      content?.slice(0, 120) + (content?.length > 120 ? '...' : ''),
    )

    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete announcement (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
