const ProductExpense = require('../models/ProductExpense.model');
const Product        = require('../models/Product.model');

/**
 * POST /api/products/:productId/expenses
 * Add an expense entry for a specific product.
 */
const addExpense = async (req, res) => {
  try {
    const { productId } = req.params;
    const { amount, date, description, category } = req.body;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Valid expense amount is required' });
    }

    const expense = await ProductExpense.create({
      productId,
      amount:      Number(amount),
      date:        date || Date.now(),
      description: description?.trim() || '',
      category:    category?.trim()    || 'other',
      addedBy:     req.user.id,
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/products/:productId/expenses
 * Get all expenses for a specific product, sorted newest first.
 * Also returns total expense amount for the product.
 */
const getExpenses = async (req, res) => {
  try {
    const { productId } = req.params;

    const expenses = await ProductExpense.find({ productId })
      .sort({ date: -1 })
      .populate('addedBy', 'name email');

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({ success: true, count: expenses.length, totalExpense, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/products/expenses/:expenseId
 * Delete a specific expense entry.
 */
const deleteExpense = async (req, res) => {
  try {
    const expense = await ProductExpense.findByIdAndDelete(req.params.expenseId);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/products/expenses/summary
 * Returns total expenses grouped by product.
 */
const getExpenseSummary = async (req, res) => {
  try {
    const summary = await ProductExpense.aggregate([
      {
        $group: {
          _id:          '$productId',
          totalExpense: { $sum: '$amount' },
          count:        { $sum: 1 },
        },
      },
      {
        $lookup: {
          from:         'products',
          localField:   '_id',
          foreignField: '_id',
          as:           'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmpty: true } },
      {
        $project: {
          productId:    '$_id',
          productName:  '$product.name',
          totalExpense: 1,
          count:        1,
        },
      },
      { $sort: { totalExpense: -1 } },
    ]);

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { addExpense, getExpenses, deleteExpense, getExpenseSummary };
