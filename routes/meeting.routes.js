const router = require('express').Router()
const { protect, adminOnly, crmAccess } = require('../middleware/auth.middleware')
const { getAllMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting } = require('../controllers/meeting.controller')

// Admin sees all meetings
router.get('/',       protect, adminOnly, getAllMeetings)
router.get('/:id',    protect, adminOnly, getMeeting)
router.delete('/:id', protect, adminOnly, deleteMeeting)

// Both admin & team_member can schedule meetings
router.post('/',      protect, crmAccess, createMeeting)
router.put('/:id',    protect, crmAccess, updateMeeting)

module.exports = router
