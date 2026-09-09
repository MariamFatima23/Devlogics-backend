const mongoose = require('mongoose');

// Calculate next billing date based on plan type
function calcNextBillingDate(startDate, planType) {
  const d = new Date(startDate);
  if (planType === 'plan-a-monthly') d.setMonth(d.getMonth() + 1);
  if (planType === 'plan-b-daily')   d.setDate(d.getDate() + 1);
  return d;
}

const subscriptionSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: [true, 'Lead is required'],
    },
    planType: {
      type: String,
      enum: ['plan-a-monthly', 'plan-b-daily'],
      required: [true, 'Plan type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    nextBillingDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled'],
      default: 'active',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Cron reminder tracking — prevents duplicate emails per trigger day
    lastReminderSentAt:   { type: Date,   default: null },
    lastReminderDaysLeft: { type: Number, default: null },
    // Renewal request tracking
    renewalRequested:     { type: Boolean, default: false },
    renewalRequestedAt:   { type: Date,    default: null },
  },
  { timestamps: true }
);

// Auto-set nextBillingDate on create
subscriptionSchema.pre('save', function (next) {
  if (this.startDate && this.planType && !this.nextBillingDate) {
    this.nextBillingDate = calcNextBillingDate(this.startDate, this.planType);
  }
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
module.exports.calcNextBillingDate = calcNextBillingDate;
