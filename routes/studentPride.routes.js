const express = require('express')
const router  = express.Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const upload  = require('../middleware/upload.middleware')
const { processUploads } = require('../middleware/upload.middleware')
const StudentPride = require('../models/StudentPride.model')

// Public: get active students (ordered)
router.get('/', async (req, res) => {
  try {
    const students = await StudentPride.find({ isActive: true }).sort({ order: 1, createdAt: -1 })
    res.json(students)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: get all
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const students = await StudentPride.find().sort({ order: 1, createdAt: -1 })
    res.json(students)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: create with image upload
router.post('/', protect, adminOnly, upload.single('image'), processUploads, async (req, res) => {
  try {
    const student = await StudentPride.create({
      name:       req.body.name,
      role:       req.body.role || '',
      courseType: req.body.courseType || 'Course',
      courseName: req.body.courseName || '',
      badge:      req.body.badge || '',
      quote:      req.body.quote,
      color:      req.body.color || 'from-blue-600 to-blue-900',
      order:      Number(req.body.order) || 0,
      image:      req.file?.cloudinaryUrl || req.file?.filename || '',
    })
    res.status(201).json(student)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: update (with optional image)
router.patch('/:id', protect, adminOnly, upload.single('image'), processUploads, async (req, res) => {
  try {
    const update = { ...req.body }
    if (req.file) update.image = req.file.cloudinaryUrl || req.file.filename
    if (update.order) update.order = Number(update.order)
    const student = await StudentPride.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!student) return res.status(404).json({ message: 'Not found' })
    res.json(student)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: delete
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await StudentPride.findByIdAndDelete(req.params.id)
    res.json({ message: 'Deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
