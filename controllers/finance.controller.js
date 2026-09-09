const Transaction = require('../models/Transaction.model');

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Build a MongoDB filter object from optional query params:
 *   ?type=income&startDate=2024-01-01&endDate=2024-12-31
 */
function buildFilter({ type, startDate, endDate }) {
  const filter = {};
  if (type) filter.type = type;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate)   filter.date.$lte = new Date(endDate);
  }
  return filter;
}

// ── Controllers ──────────────────────────────────────────────────

/**
 * POST /api/finance
 * Add a new transaction entry.
 */
const addTransaction = async (req, res) => {
  try {
    const { type, category, amount, date, description, paidTo, status } = req.body;

    // For liability, default status to "pending" if not provided
    const resolvedStatus =
      type === 'liability' ? (status || 'pending') : null;

    const transaction = await Transaction.create({
      type,
      category,
      amount,
      date,
      description,
      paidTo,
      status: resolvedStatus,
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/finance
 * Fetch all transactions. Supports ?type=&startDate=&endDate= filters.
 */
const getAllTransactions = async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .populate('createdBy', 'name email');

    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/finance/:id
 * Update an existing transaction.
 */
const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const { type, category, amount, date, description, paidTo, status } = req.body;

    // Re-calculate status if type changed
    let resolvedStatus = transaction.status;
    if (type !== undefined) {
      resolvedStatus = type === 'liability' ? (status || transaction.status || 'pending') : null;
    }

    const updated = await Transaction.findByIdAndUpdate(
      req.params.id,
      { type, category, amount, date, description, paidTo, status: resolvedStatus },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/finance/:id
 * Delete a transaction by ID.
 */
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/finance/:id/mark-paid
 * Mark a liability transaction as "paid".
 */
const markLiabilityAsPaid = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    if (transaction.type !== 'liability') {
      return res.status(400).json({ success: false, message: 'Only liability transactions can be marked as paid' });
    }

    transaction.status = 'paid';
    await transaction.save();

    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/finance/summary
 * Returns totals for each type + netProfit + netWorth via aggregation.
 *
 * Response shape:
 * {
 *   totalIncome, totalExpense, totalAssets, totalLiabilities,
 *   netProfit, netWorth
 * }
 */
const getFinanceSummary = async (req, res) => {
  try {
    const results = await Transaction.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Convert array to map for easy lookup
    const map = {};
    results.forEach(({ _id, total }) => { map[_id] = total; });

    const totalIncome      = map['income']      || 0;
    const totalExpense     = map['expense']     || 0;
    const totalAssets      = map['asset']       || 0;
    const totalLiabilities = map['liability']   || 0;

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        totalAssets,
        totalLiabilities,
        netProfit:  totalIncome - totalExpense,
        netWorth:   totalAssets - totalLiabilities,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/finance/monthly-report?year=2024&month=3
 *
 * If only ?year=2024 is passed → returns all months for that year.
 * If ?year=2024&month=3 is passed → returns daily breakdown for that month.
 *
 * Response shape (year-only):
 * [{ _id: { month: 1, type: "income" }, total: 5000 }, ...]
 *
 * Frontend should group by month and separate income vs expense.
 */
const getMonthlyReport = async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || null;

    const matchStage = {
      type: { $in: ['income', 'expense'] },
      date: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31T23:59:59`),
      },
    };

    if (month) {
      // Narrow to the specific month
      const lastDay = new Date(year, month, 0).getDate(); // handles variable month lengths
      matchStage.date = {
        $gte: new Date(`${year}-${String(month).padStart(2, '0')}-01`),
        $lte: new Date(`${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`),
      };
    }

    const report = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            type:  '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]);

    // Reshape into a cleaner array: [{ month, income, expense }, ...]
    const monthMap = {};
    report.forEach(({ _id, total }) => {
      const m = _id.month;
      if (!monthMap[m]) monthMap[m] = { month: m, income: 0, expense: 0 };
      monthMap[m][_id.type] = total;
    });

    const data = Object.values(monthMap).sort((a, b) => a.month - b.month);

    res.json({ success: true, year, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  addTransaction,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  markLiabilityAsPaid,
  getFinanceSummary,
  getMonthlyReport,
};
