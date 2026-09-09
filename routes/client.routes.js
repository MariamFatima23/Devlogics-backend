const express = require('express');
const router  = express.Router();

const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
  getAllClients,
  addClient,
  updateClient,
  deleteClient,
  getClientBillings,
  addBilling,
  updateBilling,
  deleteBilling,
  getExpiryAlerts,
  sendExpiryAlerts,
} = require('../controllers/client.controller');

// ── Specific routes BEFORE /:id ───────────────────────────────────
router.get('/expiry-alerts',         protect, adminOnly, getExpiryAlerts);
router.post('/send-expiry-alerts',   protect, adminOnly, sendExpiryAlerts);

// ── Client CRUD ───────────────────────────────────────────────────
router.get('/',    protect, adminOnly, getAllClients);
router.post('/',   protect, adminOnly, addClient);
router.put('/:id',    protect, adminOnly, updateClient);
router.delete('/:id', protect, adminOnly, deleteClient);

// ── Billing CRUD ──────────────────────────────────────────────────
router.get('/:clientId/billings',  protect, adminOnly, getClientBillings);
router.post('/:clientId/billings', protect, adminOnly, addBilling);
router.put('/billings/:billingId',    protect, adminOnly, updateBilling);
router.delete('/billings/:billingId', protect, adminOnly, deleteBilling);

module.exports = router;
