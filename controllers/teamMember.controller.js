const TeamMember = require('../models/TeamMember.model')
const User       = require('../models/User.model')
const bcrypt     = require('bcryptjs')

const getAll = async (req, res) => {
  try {
    const members = await TeamMember.find().sort({ createdAt: -1 })
    res.json(members)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// Create team member + linked User account for login
const create = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body

    if (!email) return res.status(400).json({ message: 'Email is required for team member login' })
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })

    // Check if email already used
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) return res.status(400).json({ message: 'Email already registered' })

    // Create team member record
    const member = await TeamMember.create({
      name, email: email.toLowerCase(), phone, role,
      addedBy: req.user.id,
    })

    // Create linked User account
    const hashedPw = await bcrypt.hash(password, 10)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPw,
      role: 'team_member',
      phone: phone || '',
      teamMemberRef: member._id,
    })

    // Save userId back to TeamMember
    member.userId = user._id
    await member.save()

    res.status(201).json({
      member,
      message: `Team member created. Login: ${email} / ${password}`,
    })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const update = async (req, res) => {
  try {
    const { password, ...rest } = req.body
    const member = await TeamMember.findByIdAndUpdate(req.params.id, rest, { new: true, runValidators: true })
    if (!member) return res.status(404).json({ message: 'Team member not found' })

    // If password change requested, update linked User too
    if (password && password.length >= 6 && member.userId) {
      const hashedPw = await bcrypt.hash(password, 10)
      await User.findByIdAndUpdate(member.userId, { password: hashedPw })
    }
    // Sync name/email/phone to User
    if (member.userId) {
      const syncData = {}
      if (rest.name)  syncData.name  = rest.name
      if (rest.phone) syncData.phone = rest.phone
      if (Object.keys(syncData).length) await User.findByIdAndUpdate(member.userId, syncData)
    }

    res.json(member)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const remove = async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndDelete(req.params.id)
    if (!member) return res.status(404).json({ message: 'Team member not found' })

    // Remove linked User account
    if (member.userId) {
      await User.findByIdAndDelete(member.userId)
    }

    res.json({ message: 'Team member and login account deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getAll, create, update, remove }
