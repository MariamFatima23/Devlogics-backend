const express = require('express');
const router  = express.Router();

const { protect, financeOrAdmin } = require('../middleware/auth.middleware');
const {
  addTransaction,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  markLiabilityAsPaid,
  getFinanceSummary,
  getMonthlyReport,
} = require('../controllers/finance.controller');

// Finance routes — admin OR team_member with financeAccess
// NOTE: specific routes MUST come before /:id routes to avoid conflicts
router.get('/summary',        protect, financeOrAdmin, getFinanceSummary);
router.get('/monthly-report', protect, financeOrAdmin, getMonthlyReport);

router.get('/',  protect, financeOrAdmin, getAllTransactions);
router.post('/', protect, financeOrAdmin, addTransaction);

router.put('/:id',           protect, financeOrAdmin, updateTransaction);
router.delete('/:id',        protect, financeOrAdmin, deleteTransaction);
router.put('/:id/mark-paid', protect, financeOrAdmin, markLiabilityAsPaid);

module.exports = router;
