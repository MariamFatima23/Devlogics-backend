const express = require('express')
const router  = express.Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const upload  = require('../middleware/upload.middleware')
const CourseApplication = require('../models/CourseApplication.model')
const Notification = require('../models/Notification.model')
const Course = require('../models/Course.model')

// Student: Apply for a course (CV + payment proof + signature + security upload)
router.post('/', protect, upload.fields([
  { name: 'cvFile',        maxCount: 1 },
  { name: 'paymentProof',  maxCount: 1 },
  { name: 'signatureFile', maxCount: 1 },
  { name: 'securityProof', maxCount: 1 },
]), async (req, res) => {
  try {
    const course = await Course.findById(req.body.courseId)
    if (!course) return res.status(404).json({ message: 'Course not found' })

    // Check if already applied
    const existing = await CourseApplication.findOne({
      courseId: req.body.courseId,
      studentId: req.user.id,
    })
    if (existing) return res.status(400).json({ message: 'You have already applied for this course' })

    const cvFile      = req.files?.cvFile?.[0]
    const payProof    = req.files?.paymentProof?.[0]
    const sigFile     = req.files?.signatureFile?.[0]

    // If no new CV uploaded but student has one saved in profile, use it
    let cvFileName     = cvFile?.filename        || null
    let cvOriginalName = cvFile?.originalname    || null
    if (!cvFileName && req.body.useProfileCv === 'true') {
      const studentUser = await require('../models/User.model').findById(req.user.id).select('cv')
      if (studentUser?.cv) {
        cvFileName     = studentUser.cv
        cvOriginalName = studentUser.cv
      }
    }

    // ── Build payment installments ──
    const paymentPlan = req.body.paymentPlan || ''  // 'full' | 'installment'
    const totalFee    = course.price || 0
    let   amountPaid  = 0
    let   installments = []

    if (course.isPaid && totalFee > 0) {
      const firstProof = req.files?.paymentProof?.[0]

      if (paymentPlan === 'installment' && course.allowsInstallments) {
        const count       = course.installmentCount || 2
        const perAmount   = Math.ceil(totalFee / count)
        const now         = new Date()

        for (let i = 1; i <= count; i++) {
          const dueDate = new Date(now)
          dueDate.setMonth(dueDate.getMonth() + (i - 1))

          installments.push({
            installmentNo: i,
            amount:        perAmount,
            dueDate,
            status:        i === 1 ? (firstProof ? 'paid' : 'pending') : 'pending',
            paidDate:      i === 1 && firstProof ? now : undefined,
            proofFile:     i === 1 ? firstProof?.filename : undefined,
            paymentMethod: i === 1 ? req.body.paymentMethod : undefined,
            transactionId: i === 1 ? req.body.transactionId : undefined,
          })
        }
        amountPaid = firstProof ? perAmount : 0
      } else {
        // Full payment
        installments = [{
          installmentNo: 1,
          amount:        totalFee,
          dueDate:       new Date(),
          status:        payProof ? 'paid' : 'pending',
          paidDate:      payProof ? new Date() : undefined,
          proofFile:     payProof?.filename,
          paymentMethod: req.body.paymentMethod,
          transactionId: req.body.transactionId,
        }]
        amountPaid = payProof ? totalFee : 0
      }
    }

    const app = await CourseApplication.create({
      courseId:       course._id,
      courseName:     course.title,
      courseType:     course.type,
      studentId:      req.user.id,
      studentName:    req.user.name,
      studentEmail:   req.user.email,
      phone:          req.body.phone,
      cnic:           req.body.cnic,
      qualification:  req.body.qualification,
      experience:     req.body.experience || 'None',
      whyApply:       req.body.whyApply,
      linkedIn:       req.body.linkedIn,
      portfolio:      req.body.portfolio,
      cvFile:         cvFileName,
      cvOriginalName: cvOriginalName,
      // Payment
      paymentPlan,
      totalFee,
      amountPaid,
      amountRemaining: totalFee - amountPaid,
      installments,
      paymentProof:   payProof?.filename,
      paymentMethod:  req.body.paymentMethod,
      transactionId:  req.body.transactionId,
      // Agreement
      agreementSigned: req.body.agreementSigned === 'true',
      signatureFile:  sigFile?.filename,
      securityType:   req.body.securityType  || '',
      securityProof:  req.files?.securityProof?.[0]?.filename || null,
      timeline: [{ status:'Pending', comment:'Application submitted', updatedBy: req.user.name }],
    })

    // Notification to student
    await Notification.create({
      userId: req.user.id,
      applicationId: app._id,
      type: 'application_submitted',
      title: 'Course Application Submitted',
      message: `Your application for "${course.title}" has been submitted and is under review.`,
    })

    // Notify all admins about new course application
    const { notifyAdmins } = require('./notification.routes')
    await notifyAdmins(
      'new_course_application',
      '📋 New Course Application',
      `${req.user.name} applied for "${course.title}". Review and take action.`,
      { applicationId: app._id },
    )

    res.status(201).json({ message: 'Application submitted successfully', application: app })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Student: Get my course applications
router.get('/my', protect, async (req, res) => {
  try {
    const apps = await CourseApplication.find({ studentId: req.user.id }).sort({ createdAt: -1 })
    res.json(apps)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: Get all applications (with optional filters)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const filter = {}
    if (req.query.status)    filter.status    = req.query.status
    if (req.query.courseId)  filter.courseId  = req.query.courseId
    if (req.query.courseType) filter.courseType = req.query.courseType
    if (req.query.studentId) filter.studentId = req.query.studentId
    const apps = await CourseApplication.find(filter).sort({ createdAt: -1 })
    res.json(apps)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: Update application status
router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, adminComment } = req.body
    const app = await CourseApplication.findById(req.params.id)
    if (!app) return res.status(404).json({ message: 'Application not found' })

    app.status      = status
    app.adminComment = adminComment || ''
    app.reviewedBy  = req.user.name
    app.reviewedAt  = new Date()
    app.timeline.push({ status, comment: adminComment || `Status changed to ${status}`, updatedBy: req.user.name })
    await app.save()

    // Notify student
    const notifType = status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : 'status_updated'
    await Notification.create({
      userId: app.studentId,
      type:   notifType,
      title:  `Application ${status}`,
      message: status === 'Approved'
        ? `Congratulations! Your application for "${app.courseName}" has been approved.`
        : status === 'Rejected'
        ? `Your application for "${app.courseName}" was rejected.${adminComment ? ' Reason: ' + adminComment : ''}`
        : `Your application for "${app.courseName}" is now "${status}".`,
    })

    res.json({ message: `Application ${status}`, application: app })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Student: Submit next installment payment proof
router.post('/:id/installment', protect, upload.single('proofFile'), async (req, res) => {
  try {
    const app = await CourseApplication.findOne({ _id: req.params.id, studentId: req.user.id })
    if (!app) return res.status(404).json({ message: 'Application not found' })

    const installmentNo = parseInt(req.body.installmentNo)
    const inst = app.installments.find(i => i.installmentNo === installmentNo)
    if (!inst) return res.status(404).json({ message: 'Installment not found' })
    if (inst.status === 'paid') return res.status(400).json({ message: 'Already paid' })

    inst.proofFile     = req.file?.filename
    inst.paymentMethod = req.body.paymentMethod
    inst.transactionId = req.body.transactionId
    inst.status        = 'paid'
    inst.paidDate      = new Date()

    // Recalculate totals
    app.amountPaid      = app.installments.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)
    app.amountRemaining = (app.totalFee || 0) - app.amountPaid

    await app.save()

    await Notification.create({
      userId: app.studentId,
      type:   'payment_received',
      title:  'Installment Submitted',
      message: `Your installment #${installmentNo} for "${app.courseName}" has been submitted and is pending verification.`,
    })
    const { notifyAdmins } = require('./notification.routes')
    await notifyAdmins('payment_received', '💳 Installment Received',
      `${req.user.name} submitted installment #${installmentNo} for "${app.courseName}".`,
      { applicationId: app._id })

    res.json({ message: 'Installment submitted', application: app })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: Verify / update installment status
router.patch('/:id/installment/:no/verify', protect, adminOnly, async (req, res) => {
  try {
    const app = await CourseApplication.findById(req.params.id)
    if (!app) return res.status(404).json({ message: 'Application not found' })

    const inst = app.installments.find(i => i.installmentNo === parseInt(req.params.no))
    if (!inst) return res.status(404).json({ message: 'Installment not found' })

    inst.status     = req.body.status   // 'paid' | 'overdue'
    inst.verifiedBy = req.user.name
    inst.verifiedAt = new Date()
    inst.note       = req.body.note || ''

    // Update next installment due date if admin sets it
    if (req.body.nextDueDate) {
      const nextInst = app.installments.find(i => i.installmentNo === parseInt(req.params.no) + 1)
      if (nextInst) nextInst.dueDate = new Date(req.body.nextDueDate)
    }

    app.amountPaid      = app.installments.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)
    app.amountRemaining = (app.totalFee || 0) - app.amountPaid
    await app.save()

    await Notification.create({
      userId: app.studentId,
      type:   'payment_verified',
      title:  inst.status === 'paid' ? '✅ Payment Verified' : '⚠️ Payment Issue',
      message: inst.status === 'paid'
        ? `Installment #${req.params.no} for "${app.courseName}" has been verified. Remaining: PKR ${app.amountRemaining}.`
        : `There is an issue with your installment #${req.params.no} for "${app.courseName}". ${req.body.note || ''}`,
    })

    res.json({ message: 'Installment updated', application: app })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: Stats
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [total, pending, underReview, approved, rejected] = await Promise.all([
      CourseApplication.countDocuments(),
      CourseApplication.countDocuments({ status:'Pending' }),
      CourseApplication.countDocuments({ status:'Under Review' }),
      CourseApplication.countDocuments({ status:'Approved' }),
      CourseApplication.countDocuments({ status:'Rejected' }),
    ])
    res.json({ total, pending, underReview, approved, rejected })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
