const TeamMember = require('../models/TeamMember.model')

const getAll = async (req, res) => {
  try {
    const members = await TeamMember.find().sort({ createdAt: -1 })
    res.json(members)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const create = async (req, res) => {
  try {
    const { name, email, phone, role } = req.body
    const member = await TeamMember.create({ name, email, phone, role, addedBy: req.user.id })
    res.status(201).json(member)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const update = async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!member) return res.status(404).json({ message: 'Team member not found' })
    res.json(member)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const remove = async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndDelete(req.params.id)
    if (!member) return res.status(404).json({ message: 'Team member not found' })
    res.json({ message: 'Team member deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getAll, create, update, remove }
