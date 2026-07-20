const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/contact.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Public — submit a contact message
router.post('/', ctrl.submitMessage);

// Admin only — view, mark read, delete
router.get('/',           protect, adminOnly, ctrl.getMessages);
router.patch('/:id/read', protect, adminOnly, ctrl.markRead);
router.delete('/:id',     protect, adminOnly, ctrl.deleteMessage);

module.exports = router;
