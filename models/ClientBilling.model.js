const mongoose = require('mongoose');

// Auto-calculate endDate from startDate + tenure
function calcEndDate(startDate, tenure) {
  const d = new Date(startDate);
  if (tenure === '1 Year')  d.setFullYear(d.getFullYear() + 1);
  if (tenure === '2 Years') d.setFullYear(d.getFullYear() + 2);
  if (tenure === '6 Months') d.setMonth(d.getMonth() + 6);
  return d;
}

const clientBillingSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    tenure: {
      type: String,
      enum: ['6 Months', '1 Year', '2 Years'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Cancelled'],
      default: 'Active',
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-set endDate before saving
clientBillingSchema.pre('save', function (next) {
  if (this.startDate && this.tenure) {
    this.endDate = calcEndDate(this.startDate, this.tenure);
  }
  next();
});

// Also handle findOneAndUpdate — recalculate endDate if tenure/startDate change
clientBillingSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const tenure    = update.tenure    || update['$set']?.tenure;
  const startDate = update.startDate || update['$set']?.startDate;
  if (tenure && startDate) {
    const endDate = calcEndDate(startDate, tenure);
    if (update['$set']) update['$set'].endDate = endDate;
    else update.endDate = endDate;
  }
  next();
});

module.exports = mongoose.model('ClientBilling', clientBillingSchema);
