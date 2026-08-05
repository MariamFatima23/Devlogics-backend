const router = require('express').Router()
const { protect, adminOnly, crmAccess } = require('../middleware/auth.middleware')
const {
  getAllMeetings, getMeetingsByLead, getOverdueMeetings,
  getMeeting, createMeeting, rescheduleMeeting, completeMeeting,
  updateMeeting, deleteMeeting,
} = require('../controllers/meeting.controller')

// Admin sees all / manages all
router.get('/',               protect, adminOnly,  getAllMeetings)
router.get('/overdue',        protect, crmAccess,  getOverdueMeetings)
router.get('/lead/:leadId',   protect, crmAccess,  getMeetingsByLead)
router.get('/:id',            protect, adminOnly,  getMeeting)
router.delete('/:id',         protect, adminOnly,  deleteMeeting)

// Both admin & team_member can schedule + update
router.post('/',              protect, crmAccess,  createMeeting)
router.put('/:id/reschedule', protect, crmAccess,  rescheduleMeeting)
router.put('/:id/complete',   protect, crmAccess,  completeMeeting)
router.put('/:id',            protect, crmAccess,  updateMeeting)

module.exports = router
