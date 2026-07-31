const Lead           = require('../models/Lead.model')
const LeadAssignment = require('../models/LeadAssignment.model')
const Meeting        = require('../models/Meeting.model')

// ── GET all leads (admin) ──────────────────────────────────────────
const getAllLeads = async (req, res) => {
  try {
    const { status, grade, source, search } = req.query
    const filter = {}
    if (status)  filter.status = status
    if (grade)   filter.grade  = grade
    if (source)  filter.source = source
    if (search) {
      const re = new RegExp(search, 'i')
      filter.$or = [{ clientName: re }, { contact: re }, { email: re }, { purpose: re }]
    }

    const leads = await Lead.find(filter).sort({ createdAt: -1 })

    // Attach assignments to each lead
    const leadIds = leads.map(l => l._id)
    const assignments = await LeadAssignment.find({ leadId: { $in: leadIds } })
      .populate('teamMemberId', 'name role')
      .sort({ createdAt: -1 })

    const assignMap = {}
    assignments.forEach(a => {
      const key = a.leadId.toString()
      if (!assignMap[key]) assignMap[key] = []
      assignMap[key].push(a)
    })

    const data = leads.map(l => ({
      ...l.toObject(),
      assignments: assignMap[l._id.toString()] || [],
    }))

    res.json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── CREATE lead ────────────────────────────────────────────────────
const createLead = async (req, res) => {
  try {
    const { clientName, contact, email, source, purpose, notes, grade } = req.body
    const lead = await Lead.create({
      clientName, contact, email, source, purpose, notes,
      grade: grade || 'Ungraded',
      createdBy: req.user.id,
      createdByName: req.user.name,
    })
    res.status(201).json(lead)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── UPDATE lead ────────────────────────────────────────────────────
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!lead) return res.status(404).json({ message: 'Lead not found' })
    res.json(lead)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── DELETE lead ────────────────────────────────────────────────────
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })
    // Also remove assignments & meetings
    await LeadAssignment.deleteMany({ leadId: req.params.id })
    await Meeting.deleteMany({ leadId: req.params.id })
    res.json({ message: 'Lead deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── ASSIGN lead to team member(s) ─────────────────────────────────
const assignLead = async (req, res) => {
  try {
    const { teamMemberIds, note } = req.body // array of teamMember IDs
    const leadId = req.params.id

    const lead = await Lead.findById(leadId)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    const TeamMember = require('../models/TeamMember.model')
    const members = await TeamMember.find({ _id: { $in: teamMemberIds } })

    const created = []
    for (const m of members) {
      // Avoid duplicate assignment to same member
      const exists = await LeadAssignment.findOne({ leadId, teamMemberId: m._id })
      if (!exists) {
        const a = await LeadAssignment.create({
          leadId,
          teamMemberId: m._id,
          teamMemberName: m.name,
          assignedBy: req.user.id,
          assignedByName: req.user.name,
          note: note || '',
        })
        created.push(a)
      }
    }

    // Update lead status to Assigned
    if (lead.status === 'New') {
      await Lead.findByIdAndUpdate(leadId, { status: 'Assigned' })
    }

    res.status(201).json({ message: `${created.length} assignment(s) created`, assignments: created })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── REMOVE a single assignment ─────────────────────────────────────
const removeAssignment = async (req, res) => {
  try {
    await LeadAssignment.findByIdAndDelete(req.params.assignmentId)
    res.json({ message: 'Assignment removed' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── GET assignments for a lead ─────────────────────────────────────
const getLeadAssignments = async (req, res) => {
  try {
    const assignments = await LeadAssignment.find({ leadId: req.params.id })
      .populate('teamMemberId', 'name role phone email')
    res.json(assignments)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── CRM KPI Stats ──────────────────────────────────────────────────
const getCrmStats = async (req, res) => {
  try {
    const [
      totalLeads,
      byStatus,
      byGrade,
      bySource,
      totalMeetings,
      meetingsByStatus,
      meetingsByOutcome,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lead.aggregate([{ $group: { _id: '$grade',  count: { $sum: 1 } } }]),
      Lead.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
      Meeting.countDocuments(),
      Meeting.aggregate([{ $group: { _id: '$status',  count: { $sum: 1 } } }]),
      Meeting.aggregate([{ $group: { _id: '$outcome', count: { $sum: 1 } } }]),
    ])

    // Monthly lead trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyTrend = await Lead.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])

    // Team performance: assignments per member + conversions
    const TeamMember  = require('../models/TeamMember.model')
    const allMembers  = await TeamMember.find({ status: 'Active' })
    const assignments = await LeadAssignment.find()
    const assignCountMap = {}
    assignments.forEach(a => {
      const key = a.teamMemberId?.toString()
      if (key) assignCountMap[key] = (assignCountMap[key] || 0) + 1
    })

    const teamPerformance = allMembers.map(m => ({
      _id:         m._id,
      name:        m.name,
      role:        m.role,
      assignedLeads: assignCountMap[m._id.toString()] || 0,
    }))

    // Funnel: leads → assigned → meetings → interested → converted
    const assignedCount   = await Lead.countDocuments({ status: { $in: ['Assigned', 'In Progress', 'Converted'] } })
    const meetingsHeld    = await Meeting.countDocuments({ status: 'Completed' })
    const interestedCount = await Meeting.countDocuments({ outcome: 'Interested' })
    const convertedCount  = await Lead.countDocuments({ status: 'Converted' })

    res.json({
      totalLeads,
      byStatus,
      byGrade,
      bySource,
      totalMeetings,
      meetingsByStatus,
      meetingsByOutcome,
      monthlyTrend,
      teamPerformance,
      funnel: {
        totalLeads,
        assigned:    assignedCount,
        meetingsHeld,
        interested:  interestedCount,
        converted:   convertedCount,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getAllLeads, createLead, updateLead, deleteLead, assignLead, removeAssignment, getLeadAssignments, getCrmStats }
