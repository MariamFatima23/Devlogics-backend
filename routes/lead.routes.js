const router = require('express').Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const {
  getAllLeads, createLead, updateLead, deleteLead,
  assignLead, removeAssignment, getLeadAssignments, getCrmStats,
} = require('../controllers/lead.controller')

// All routes require login; most require admin
router.use(protect)

router.get('/stats',                   adminOnly, getCrmStats)
router.get('/',                        adminOnly, getAllLeads)
router.post('/',                       adminOnly, createLead)
router.put('/:id',                     adminOnly, updateLead)
router.delete('/:id',                  adminOnly, deleteLead)

// Assignments
router.get('/:id/assignments',         adminOnly, getLeadAssignments)
router.post('/:id/assign',             adminOnly, assignLead)
router.delete('/assignments/:assignmentId', adminOnly, removeAssignment)

module.exports = router
