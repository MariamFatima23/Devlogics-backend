const router = require('express').Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const { getAll, create, update, remove } = require('../controllers/teamMember.controller')

router.use(protect, adminOnly)

router.get('/',     getAll)
router.post('/',    create)
router.put('/:id',  update)
router.delete('/:id', remove)

module.exports = router
