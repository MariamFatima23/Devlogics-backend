const express  = require('express')
const router   = express.Router()
const { protect, adminOnly } = require('../middleware/auth.middleware')
const upload   = require('../middleware/upload.middleware')
const { processUploads } = require('../middleware/upload.middleware')
const SiteSettings = require('../models/SiteSettings.model')

// Public: get settings
router.get('/', async (req, res) => {
  try {
    let settings = await SiteSettings.findOne()
    if (!settings) settings = await SiteSettings.create({})
    const obj = settings.toObject()
    // Ensure array fields are never null/undefined for frontend safety
    obj.partners    = Array.isArray(obj.partners)    ? obj.partners    : []
    obj.howItWorks  = Array.isArray(obj.howItWorks)  ? obj.howItWorks  : []
    obj.features    = Array.isArray(obj.features)    ? obj.features    : []
    obj.aboutPoints = Array.isArray(obj.aboutPoints) ? obj.aboutPoints : []
    res.json(obj)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Admin: update settings (with optional logo upload)
router.patch('/', protect, adminOnly, upload.single('logo'), processUploads, async (req, res) => {
  try {
    let settings = await SiteSettings.findOne()
    if (!settings) settings = new SiteSettings()

    const fields = ['portalName','tagline','heroSubtext','statStudents','statPrograms',
                    'statSatisfaction','aboutTitle','aboutSubtitle','footerTagline',
                    'contactEmail','contactPhone','contactAddress','contactWebsite','contactHours']
    fields.forEach(f => { if (req.body[f] !== undefined) settings[f] = req.body[f] })

    // Array fields — sent as JSON strings
    const arrayFields = ['partners','howItWorks','features','aboutPoints']
    arrayFields.forEach(f => {
      if (req.body[f] !== undefined) {
        try { settings[f] = JSON.parse(req.body[f]) } catch { settings[f] = req.body[f] }
      }
    })

    // Theme colors
    if (req.body.theme) {
      try {
        const t = typeof req.body.theme === 'string' ? JSON.parse(req.body.theme) : req.body.theme
        settings.theme = { ...settings.theme?.toObject?.() || {}, ...t }
      } catch { /* ignore */ }
    }

    if (req.file) settings.logoUrl = req.file.cloudinaryUrl || req.file.filename
    if (req.body.aboutImage && req.file) settings.aboutImageUrl = req.file.cloudinaryUrl || req.file.filename

    await settings.save()
    res.json(settings)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
