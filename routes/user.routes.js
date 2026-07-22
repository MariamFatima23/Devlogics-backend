const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const upload   = require('../middleware/upload.middleware');
const { processUploads } = require('../middleware/upload.middleware');
const { getAllUsers, getUserById, updateProfile, blockUser, adminStats } = require('../controllers/user.controller');

// Update own profile (with optional image + CV)
router.patch('/profile', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
]), processUploads, updateProfile);

// Admin routes (protected)
router.get('/',            protect, adminOnly, getAllUsers);
router.get('/admin-stats', protect, adminOnly, adminStats);
router.get('/:id',         protect, adminOnly, getUserById);
router.patch('/:id/block', protect, adminOnly, blockUser);

module.exports = router;
