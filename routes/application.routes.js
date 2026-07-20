const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const {
  submitApplication,
  getMyApplications,
  getApplicationById,
  getAllApplications,
  updateStatus,
  getStats,
} = require('../controllers/application.controller');

// Stats
router.get('/stats', protect, getStats);

// Student routes
router.post('/', protect, upload.array('attachments', 5), submitApplication);
router.get('/my-applications', protect, getMyApplications);
router.get('/:id', protect, getApplicationById);

// Admin routes
router.get('/', protect, adminOnly, getAllApplications);
router.patch('/:id/status', protect, adminOnly, updateStatus);

module.exports = router;
