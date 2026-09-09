const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['income', 'expense', 'asset', 'liability'],
      required: true,
    },
    category: {
      type: String,
      required: true,
      // income    → fees | course-sale | other
      // expense   → rent | salary | utility | marketing | other
      // asset     → cash | bank | equipment | furniture
      // liability → loan | salary-due | rent-due | supplier-payment
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
    },
    // Only for expense / liability
    paidTo: {
      type: String,
      trim: true,
    },
    // Only for liability: null (default) | pending | paid
    status: {
      type: String,
      enum: ['pending', 'paid', null],
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
