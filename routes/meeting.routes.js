const router = require('express').Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const { getAllMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting } = require('../controllers/meeting.controller')

router.use(protect, adminOnly)

router.get('/',       getAllMeetings)
router.get('/:id',    getMeeting)
router.post('/',      createMeeting)
router.put('/:id',    updateMeeting)
router.delete('/:id', deleteMeeting)

module.exports = router
