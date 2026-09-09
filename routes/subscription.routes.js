const express = require('express');
const router  = express.Router();

const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
  assignSubscription,
  getAllSubscriptions,
  getDueSubscriptions,
  markAsPaid,
  updateStatus,
  getBillingHistory,
  sendDueAlerts,
  getMySubscription,
  requestRenewal,
} = require('../controllers/subscription.controller');

// ── Student routes ────────────────────────────────────────────────
router.get('/my-subscription',          protect, getMySubscription);
router.post('/:id/request-renewal',     protect, requestRenewal);   // lead calls this

// ── Admin routes ──────────────────────────────────────────────────
router.get('/due',                       protect, adminOnly, getDueSubscriptions);
router.post('/send-due-alerts',          protect, adminOnly, sendDueAlerts);
router.get('/',                          protect, adminOnly, getAllSubscriptions);
router.post('/',                         protect, adminOnly, assignSubscription);
router.get('/:id/billing-history',       protect, adminOnly, getBillingHistory);
router.put('/:id/mark-paid',             protect, adminOnly, markAsPaid);
router.put('/:id/status',               protect, adminOnly, updateStatus);

// Update plan/amount
router.put('/:id/update', protect, adminOnly, async (req, res) => {
  try {
    const { planType, amount } = req.body;
    const Subscription = require('../models/Subscription.model');
    const sub = await Subscription.findByIdAndUpdate(
      req.params.id,
      { ...(planType && { planType }), ...(amount && { amount: Number(amount) }) },
      { new: true }
    ).populate('leadId', 'clientName contact email');
    if (!sub) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: sub });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete subscription permanently
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const Subscription  = require('../models/Subscription.model');
    const BillingRecord = require('../models/BillingRecord.model');
    await BillingRecord.deleteMany({ subscriptionId: req.params.id });
    await Subscription.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Subscription deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
