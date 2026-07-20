const express = require('express')
const router  = express.Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const upload  = require('../middleware/upload.middleware')
const Review  = require('../models/Review.model')

// Public: get approved reviews (max 10)
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true, isActive: true })
      .sort({ createdAt: -1 }).limit(10)
    res.json(reviews)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Student: submit a review with image
router.post('/', protect, upload.single('studentImage'), async (req, res) => {
  try {
    const review = await Review.create({
      studentId:    req.user.id,
      studentName:  req.user.name,
      studentEmail: req.user.email,
      studentImage: req.file?.filename || '',
      courseType:   req.body.courseType || 'Course',
      courseName:   req.body.courseName || '',
      description:  req.body.description,
      rating:       Number(req.body.rating) || 5,
      isApproved:   false,
    })

    // Notify all admins about new review
    const { notifyAdmins } = require('./notification.routes')
    await notifyAdmins(
      'new_review',
      '⭐ New Review Submitted',
      `${req.user.name} submitted a ${Number(req.body.rating) || 5}-star review for "${req.body.courseName || 'a course'}". Awaiting approval.`,
    )

    res.status(201).json({ message: 'Review submitted! Waiting for admin approval.', review })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: get all reviews
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 })
    res.json(reviews)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: approve/reject review
router.patch('/:id', protect, adminOnly, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!review) return res.status(404).json({ message: 'Review not found' })
    res.json(review)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: delete review
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id)
    res.json({ message: 'Review deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
