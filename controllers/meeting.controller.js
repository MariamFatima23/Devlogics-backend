const Meeting = require('../models/Meeting.model')
const Lead    = require('../models/Lead.model')

// Auto-mark overdue meetings before returning
async function markOverdue() {
  await Meeting.updateMany(
    { status: 'Pending', scheduledAt: { $lt: new Date() } },
    { $set: { status: 'Overdue' } }
  )
}

// Outcome → lead status mapping (exact spec)
const OUTCOME_LEAD_STATUS = {
  'Converted':      'Converted',
  'Not Interested': 'Lost',
  'Follow-up Required': 'In Progress',
  'Interested':     'In Progress',
  'Objection':      'In Progress',
  'No Show':        'Assigned',
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

// ── GET meetings by lead ───────────────────────────────────────────
const getMeetingsByLead = async (req, res) => {
  try {
    await markOverdue()
    const meetings = await Meeting.find({ leadId: req.params.leadId })
      .populate('teamMemberId', 'name role')
      .sort({ scheduledAt: -1 })
    res.json(meetings)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── GET overdue meetings ───────────────────────────────────────────
const getOverdueMeetings = async (req, res) => {
  try {
    await markOverdue()
    const meetings = await Meeting.find({ status: 'Overdue' })
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
    const { leadId, teamMemberId, teamMemberName, meetingType, platform, topic, meetingLink, scheduledAt, durationMins } = req.body

    const lead = await Lead.findById(leadId)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    const meeting = await Meeting.create({
      leadId,
      leadName:       lead.clientName,
      leadContact:    lead.contact || '',
      teamMemberId:   teamMemberId || null,
      teamMemberName: teamMemberName || '',
      meetingType,
      platform,
      topic,
      meetingLink:    meetingLink || '',
      scheduledAt:    new Date(scheduledAt),
      durationMins:   durationMins || 30,
      createdBy:      req.user.id,
      createdByName:  req.user.name,
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

// ── RESCHEDULE meeting ─────────────────────────────────────────────
const rescheduleMeeting = async (req, res) => {
  try {
    const { newScheduledDate, rescheduleReason } = req.body
    const meeting = await Meeting.findById(req.params.id)
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })

    // Push old date to rescheduleHistory
    meeting.rescheduleHistory.push({
      previousDate:  meeting.scheduledAt,
      rescheduledAt: new Date(),
      reason:        rescheduleReason || '',
    })

    meeting.scheduledAt       = new Date(newScheduledDate)
    meeting.status            = 'Pending'
    meeting.rescheduledAt     = new Date()
    meeting.rescheduleReason  = rescheduleReason || ''

    await meeting.save()

    const updated = await Meeting.findById(meeting._id)
      .populate('leadId',       'clientName contact source grade status')
      .populate('teamMemberId', 'name role')

    res.json(updated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── COMPLETE meeting + outcome → update lead status ────────────────
const completeMeeting = async (req, res) => {
  try {
    const { outcome, outcomeNotes, nextActionDate } = req.body
    const meeting = await Meeting.findById(req.params.id)
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })

    meeting.status       = 'Completed'
    meeting.outcome      = outcome || ''
    meeting.outcomeNotes = outcomeNotes || ''
    if (nextActionDate) meeting.nextActionDate = new Date(nextActionDate)

    await meeting.save()

    // Update lead status based on outcome (exact spec)
    if (outcome && OUTCOME_LEAD_STATUS[outcome]) {
      await Lead.findByIdAndUpdate(meeting.leadId, {
        status: OUTCOME_LEAD_STATUS[outcome],
      })
    }

    const updated = await Meeting.findById(meeting._id)
      .populate('leadId',       'clientName contact source grade status')
      .populate('teamMemberId', 'name role')

    res.json(updated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── UPDATE meeting (general — reschedule / edit) ───────────────────
const updateMeeting = async (req, res) => {
  try {
    const update = { ...req.body }

    // If rescheduling via general update, push to history
    if (req.body.status === 'Rescheduled' && req.body.scheduledAt) {
      const old = await Meeting.findById(req.params.id)
      if (old) {
        update.$push = {
          rescheduleHistory: {
            previousDate:  old.scheduledAt,
            rescheduledAt: new Date(),
            reason:        req.body.rescheduleReason || '',
          }
        }
      }
      update.rescheduledAt = new Date()
    }

    // Outcome → lead status chain
    if (req.body.outcome && OUTCOME_LEAD_STATUS[req.body.outcome]) {
      const meeting = await Meeting.findById(req.params.id)
      if (meeting) {
        await Lead.findByIdAndUpdate(meeting.leadId, {
          status: OUTCOME_LEAD_STATUS[req.body.outcome],
        })
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

module.exports = {
  getAllMeetings, getMeetingsByLead, getOverdueMeetings,
  getMeeting, createMeeting, rescheduleMeeting, completeMeeting,
  updateMeeting, deleteMeeting,
}
