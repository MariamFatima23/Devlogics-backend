const Meeting = require('../models/Meeting.model')
const Lead    = require('../models/Lead.model')

// Auto-mark overdue meetings before returning
async function markOverdue() {
  await Meeting.updateMany(
    { status: 'Pending', scheduledAt: { $lt: new Date() } },
    { $set: { status: 'Overdue' } }
  )
}

// ── GET all meetings ───────────────────────────────────────────────
const getAllMeetings = async (req, res) => {
  try {
    await markOverdue()
    const { leadId, status, teamMemberId } = req.query
    const filter = {}
    if (leadId)       filter.leadId       = leadId
    if (status)       filter.status       = status
    if (teamMemberId) filter.teamMemberId = teamMemberId

    const meetings = await Meeting.find(filter)
      .populate('leadId',       'clientName contact source grade status')
      .populate('teamMemberId', 'name role')
      .sort({ scheduledAt: -1 })

    res.json(meetings)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── GET single meeting ─────────────────────────────────────────────
const getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('leadId',       'clientName contact source grade status')
      .populate('teamMemberId', 'name role')
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })
    res.json(meeting)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── CREATE meeting ─────────────────────────────────────────────────
const createMeeting = async (req, res) => {
  try {
    const { leadId, teamMemberId, teamMemberName, meetingType, platform, topic, scheduledAt, durationMins } = req.body

    const lead = await Lead.findById(leadId)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    const meeting = await Meeting.create({
      leadId,
      leadName: lead.clientName,
      teamMemberId: teamMemberId || null,
      teamMemberName: teamMemberName || '',
      meetingType,
      platform,
      topic,
      scheduledAt: new Date(scheduledAt),
      durationMins: durationMins || 30,
      createdBy: req.user.id,
      createdByName: req.user.name,
    })

    // Update lead status to In Progress
    if (['New', 'Assigned'].includes(lead.status)) {
      await Lead.findByIdAndUpdate(leadId, { status: 'In Progress' })
    }

    res.status(201).json(meeting)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── UPDATE meeting (reschedule / complete / add outcome) ───────────
const updateMeeting = async (req, res) => {
  try {
    const update = { ...req.body }

    // If rescheduling
    if (req.body.status === 'Rescheduled' && req.body.scheduledAt) {
      update.rescheduledAt = new Date()
      update.status        = 'Rescheduled'
    }

    // If marking completed with outcome=Converted, update lead too
    if (req.body.outcome === 'Converted') {
      const meeting = await Meeting.findById(req.params.id)
      if (meeting) {
        await Lead.findByIdAndUpdate(meeting.leadId, { status: 'Converted' })
      }
    }

    const meeting = await Meeting.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('leadId',       'clientName contact source grade status')
      .populate('teamMemberId', 'name role')

    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })
    res.json(meeting)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── DELETE meeting ─────────────────────────────────────────────────
const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id)
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })
    res.json({ message: 'Meeting deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getAllMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting }
