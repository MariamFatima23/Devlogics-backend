const mongoose = require('mongoose')

const courseApplicationSchema = new mongoose.Schema(
  {
    // Course reference
    courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    courseName:    { type: String },
    courseType:    { type: String }, // course / internship

    // Student
    studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName:   { type: String, required: true },
    studentEmail:  { type: String, required: true },

    // Application form fields
    phone:         { type: String, required: true },
    cnic:          { type: String },
    qualification: { type: String, required: true },
    experience:    { type: String, default: 'None' },
    whyApply:      { type: String, required: true },
    linkedIn:      { type: String },
    portfolio:     { type: String },

    // CV upload
    cvFile:        { type: String },
    cvOriginalName:{ type: String },

    // ── Payment Tracking ──
    paymentPlan:      { type: String, enum: ['full', 'installment', ''], default: '' },
    totalFee:         { type: Number, default: 0 },
    amountPaid:       { type: Number, default: 0 },
    amountRemaining:  { type: Number, default: 0 },

    // Installments array — each installment is a separate payment
    installments: [{
      installmentNo:  { type: Number },          // 1, 2, 3...
      amount:         { type: Number },
      dueDate:        { type: Date },
      paidDate:       { type: Date },
      status:         { type: String, enum: ['pending','paid','overdue'], default: 'pending' },
      proofFile:      { type: String },          // screenshot filename
      paymentMethod:  { type: String },
      transactionId:  { type: String },
      verifiedBy:     { type: String },          // admin name
      verifiedAt:     { type: Date },
      note:           { type: String },
    }],

    // Legacy single payment fields (kept for backward compat)
    paymentProof:  { type: String },
    paymentMethod: { type: String },
    transactionId: { type: String },

    // Internship agreement & drawn signature
    agreementSigned: { type: Boolean, default: false },
    signatureFile:   { type: String }, // base64 PNG saved as file
    // Security deposit option
    securityType:     { type: String, enum: ['fee', 'document', ''], default: '' }, // 'fee' or 'document'
    securityProof:    { type: String }, // screenshot or document filename

    // Status
    status:        { type: String, enum: ['Pending','Under Review','Approved','Rejected'], default: 'Pending' },
    adminComment:  { type: String },
    reviewedBy:    { type: String },
    reviewedAt:    { type: Date },

    timeline: [{
      status:    String,
      comment:   String,
      updatedBy: String,
      updatedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
)

module.exports = mongoose.model('CourseApplication', courseApplicationSchema)
