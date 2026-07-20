const express = require('express')
const router  = express.Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const Service = require('../models/Service.model')

// Public: get active services
router.get('/', async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ order: 1, createdAt: -1 })
    res.json(services)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: get all
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const services = await Service.find().sort({ order: 1 })
    res.json(services)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: create
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const service = await Service.create(req.body)
    res.status(201).json(service)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: update
router.patch('/:id', protect, adminOnly, async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!service) return res.status(404).json({ message: 'Service not found' })
    res.json(service)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: delete
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id)
    res.json({ message: 'Service deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
