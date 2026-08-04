const router     = require('express').Router()
const { protect, adminOnly, crmAccess } = require('../middleware/auth.middleware')
const { getAll, create, update, remove } = require('../controllers/teamMember.controller')
const LeadAssignment = require('../models/LeadAssignment.model')
const Meeting        = require('../models/Meeting.model')
const Lead           = require('../models/Lead.model')

// ── Admin-only CRUD ──────────────────────────────────────────────
router.get('/',      protect, adminOnly, getAll)
router.post('/',     protect, adminOnly, create)
router.put('/:id',   protect, adminOnly, update)
router.delete('/:id',protect, adminOnly, remove)

// ── Team member: get own profile (TeamMember record) ────────────
router.get('/me', protect, crmAccess, async (req, res) => {
  try {
    const TeamMember = require('../models/TeamMember.model')
    const member = await TeamMember.findOne({ userId: req.user.id })
    if (!member) return res.status(404).json({ message: 'Team member profile not found' })
    res.json(member)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ── Team member: get MY assigned leads ──────────────────────────
router.get('/my-leads', protect, crmAccess, async (req, res) => {
  try {
    const TeamMember = require('../models/TeamMember.model')
    let memberId = req.query.memberId // admin can pass specific memberId

    // If team_member role, find their own TeamMember record
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
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ── Team member: get MY meetings ─────────────────────────────────
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

    // Auto-mark overdue
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
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ── Team member: update meeting outcome / reschedule ────────────
router.put('/meetings/:meetingId', protect, crmAccess, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.meetingId)
      .populate('leadId', 'clientName')
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })

    // team_member can only update their own meetings
    if (req.user.role === 'team_member') {
      const TeamMember = require('../models/TeamMember.model')
      const member = await TeamMember.findOne({ userId: req.user.id })
      if (!member || meeting.teamMemberId?.toString() !== member._id.toString()) {
        return res.status(403).json({ message: 'Not your meeting' })
      }
    }

    const update = { ...req.body }
    if (req.body.status === 'Rescheduled' && req.body.scheduledAt) {
      update.rescheduledAt = new Date()
    }
    if (req.body.outcome === 'Converted' && meeting.leadId) {
      await Lead.findByIdAndUpdate(meeting.leadId._id || meeting.leadId, { status: 'Converted' })
    }

    const updated = await Meeting.findByIdAndUpdate(req.params.meetingId, update, { new: true })
      .populate('leadId', 'clientName contact source grade status')
    res.json(updated)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
