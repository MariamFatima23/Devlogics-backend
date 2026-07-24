const express  = require('express')
const router   = express.Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const upload   = require('../middleware/upload.middleware')
const { processUploads } = require('../middleware/upload.middleware')
const HeroSlide = require('../models/HeroSlide.model')

// Public: get active slides
router.get('/', async (req, res) => {
  try {
    const slides = await HeroSlide.find({ isActive: true }).sort({ order: 1 })
    res.json(slides)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: get all slides
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const slides = await HeroSlide.find().sort({ order: 1 })
    res.json(slides)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: upload slide image + create
router.post('/', protect, adminOnly, upload.single('image'), processUploads, async (req, res) => {
  try {
    const imageUrl = req.file
      ? (req.file.cloudinaryUrl || req.file.filename || '')
      : req.body.imageUrl
    const slide = await HeroSlide.create({
      imageUrl,
      text:     req.body.text || '',
      isActive: req.body.isActive !== 'false',
      order:    Number(req.body.order) || 0,
    })
    res.status(201).json(slide)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: update
router.patch('/:id', protect, adminOnly, async (req, res) => {
  try {
    const slide = await HeroSlide.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!slide) return res.status(404).json({ message: 'Slide not found' })
    res.json(slide)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: delete
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await HeroSlide.findByIdAndDelete(req.params.id)
    res.json({ message: 'Slide deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
