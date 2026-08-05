const router     = require('express').Router()
const { protect, adminOnly, crmAccess } = require('../middleware/auth.middleware')
const { getAll, create, update, remove } = require('../controllers/teamMember.controller')
const LeadAssignment = require('../models/LeadAssignment.model')
const Meeting        = require('../models/Meeting.model')
const Lead           = require('../models/Lead.model')

// ── Admin-only CRUD ──────────────────────────────────────────────
router.get('/',       protect, adminOnly, getAll)
router.post('/',      protect, adminOnly, create)
router.put('/:id',    protect, adminOnly, update)
router.delete('/:id', protect, adminOnly, remove)

// ── Team member: get own TeamMember profile ──────────────────────
router.get('/me', protect, crmAccess, async (req, res) => {
  try {
    const TeamMember = require('../models/TeamMember.model')
    const member = await TeamMember.findOne({ userId: req.user.id })
    if (!member) return res.status(404).json({ message: 'Team member profile not found' })
    res.json(member)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── Team member: get MY assigned leads ───────────────────────────
router.get('/my-leads', protect, crmAccess, async (req, res) => {
  try {
    const TeamMember = require('../models/TeamMember.model')
    let memberId = req.query.memberId

    if (req.user.role === 'team_member') {
      const member = await TeamMember.findOne({ userId: req.user.id })
      if (!member) return res.json([])
      memberId = member._id
    }

    if (!memberId) return res.status(400).json({ message: 'memberId required' })

    const assignments = await LeadAssignment.find({ teamMemberId: memberId })
    const leadIds = assignments.map(a => a.leadId)

    const { status, grade, source, search } = req.query
    const filter = { _id: { $in: leadIds } }
    if (status) filter.status = status
    if (grade)  filter.grade  = grade
    if (source) filter.source = source
    if (search) {
      const re = new RegExp(search, 'i')
      filter.$or = [{ clientName: re }, { contact: re }, { purpose: re }]
    }

    const leads = await Lead.find(filter).sort({ createdAt: -1 })
    res.json(leads)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── Team member: get MY meetings ──────────────────────────────────
router.get('/my-meetings', protect, crmAccess, async (req, res) => {
  try {
    const TeamMember = require('../models/TeamMember.model')
    let memberId = req.query.memberId

    if (req.user.role === 'team_member') {
      const member = await TeamMember.findOne({ userId: req.user.id })
      if (!member) return res.json([])
      memberId = member._id
    }

    if (!memberId) return res.status(400).json({ message: 'memberId required' })

    // Auto-mark overdue on fetch
    await Meeting.updateMany(
      { status: 'Pending', scheduledAt: { $lt: new Date() } },
      { $set: { status: 'Overdue' } }
    )

    const { status } = req.query
    const filter = { teamMemberId: memberId }
    if (status) filter.status = status

    const meetings = await Meeting.find(filter)
      .populate('leadId', 'clientName contact source grade status')
      .sort({ scheduledAt: -1 })

    res.json(meetings)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── Team member: reschedule a meeting ────────────────────────────
router.put('/meetings/:meetingId/reschedule', protect, crmAccess, async (req, res) => {
  try {
    const { newScheduledDate, rescheduleReason } = req.body
    const meeting = await Meeting.findById(req.params.meetingId)
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })

    if (req.user.role === 'team_member') {
      const TeamMember = require('../models/TeamMember.model')
      const member = await TeamMember.findOne({ userId: req.user.id })
      if (!member || meeting.teamMemberId?.toString() !== member._id.toString()) {
        return res.status(403).json({ message: 'Not your meeting' })
      }
    }

    meeting.rescheduleHistory.push({
      previousDate:  meeting.scheduledAt,
      rescheduledAt: new Date(),
      reason:        rescheduleReason || '',
    })
    meeting.scheduledAt      = new Date(newScheduledDate || req.body.scheduledAt)
    meeting.status           = 'Pending'
    meeting.rescheduledAt    = new Date()
    meeting.rescheduleReason = rescheduleReason || ''
    await meeting.save()

    const updated = await Meeting.findById(meeting._id)
      .populate('leadId', 'clientName contact source grade status')
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── Team member: complete a meeting + update lead status ──────────
router.put('/meetings/:meetingId/complete', protect, crmAccess, async (req, res) => {
  try {
    const { outcome, outcomeNotes, nextActionDate } = req.body
    const meeting = await Meeting.findById(req.params.meetingId)
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })

    if (req.user.role === 'team_member') {
      const TeamMember = require('../models/TeamMember.model')
      const member = await TeamMember.findOne({ userId: req.user.id })
      if (!member || meeting.teamMemberId?.toString() !== member._id.toString()) {
        return res.status(403).json({ message: 'Not your meeting' })
      }
    }

    const OUTCOME_LEAD_STATUS = {
      'Converted':          'Converted',
      'Not Interested':     'Lost',
      'Follow-up Required': 'In Progress',
      'Interested':         'In Progress',
      'Objection':          'In Progress',
      'No Show':            'Assigned',
    }

    meeting.status       = 'Completed'
    meeting.outcome      = outcome || ''
    meeting.outcomeNotes = outcomeNotes || ''
    if (nextActionDate) meeting.nextActionDate = new Date(nextActionDate)
    await meeting.save()

    if (outcome && OUTCOME_LEAD_STATUS[outcome]) {
      await Lead.findByIdAndUpdate(meeting.leadId, {
        status: OUTCOME_LEAD_STATUS[outcome],
      })
    }

    const updated = await Meeting.findById(meeting._id)
      .populate('leadId', 'clientName contact source grade status')
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── Team member: general meeting update ──────────────────────────
router.put('/meetings/:meetingId', protect, crmAccess, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.meetingId)
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })

    if (req.user.role === 'team_member') {
      const TeamMember = require('../models/TeamMember.model')
      const member = await TeamMember.findOne({ userId: req.user.id })
      if (!member || meeting.teamMemberId?.toString() !== member._id.toString()) {
        return res.status(403).json({ message: 'Not your meeting' })
      }
    }

    const updated = await Meeting.findByIdAndUpdate(
      req.params.meetingId, req.body, { new: true }
    ).populate('leadId', 'clientName contact source grade status')
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
