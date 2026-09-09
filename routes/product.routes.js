const express = require('express');
const router  = express.Router();

const { protect, adminOnly, productAccess } = require('../middleware/auth.middleware');
const {
  addProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require('../controllers/product.controller');

const {
  addExpense,
  getExpenses,
  deleteExpense,
  getExpenseSummary,
} = require('../controllers/productExpense.controller');

// ── Specific routes BEFORE /:id to avoid conflicts ───────────────
router.get('/expenses/summary', protect, productAccess, getExpenseSummary);

// ── Product CRUD ──────────────────────────────────────────────────
router.post('/',      protect, productAccess, addProduct);
router.get('/',       protect, productAccess, getAllProducts);
router.get('/:id',    protect, productAccess, getProductById);
router.put('/:id',    protect, productAccess, updateProduct);
router.delete('/:id', protect, productAccess, deleteProduct);

// ── Product Expense routes ────────────────────────────────────────
router.get('/:productId/expenses',    protect, productAccess, getExpenses);
router.post('/:productId/expenses',   protect, productAccess, addExpense);
router.delete('/expenses/:expenseId', protect, productAccess, deleteExpense);

module.exports = router;
