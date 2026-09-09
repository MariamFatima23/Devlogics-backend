const express  = require('express')
const router   = express.Router()
const { protect } = require('../middleware/auth.middleware')
const ChatMessage = require('../models/ChatMessage.model')
const ChatRoom    = require('../models/ChatRoom.model')
const User        = require('../models/User.model')

// ── Helper: build a stable roomId from two user IDs ──────────────
const makeRoomId = (a, b) => [a.toString(), b.toString()].sort().join('_')

// ── GET /api/chat/contacts  ───────────────────────────────────────
// Returns list of users the current user can chat with:
//   • If admin  → all students + all team_members
//   • If team   → admins + other team_members
//   • If student→ admins only
router.get('/contacts', protect, async (req, res) => {
  try {
    const me = req.user.id
    let query = {}

    if (req.user.role === 'admin') {
      query = { _id: { $ne: me }, role: { $in: ['student', 'team_member', 'admin'] } }
    } else if (req.user.role === 'team_member') {
      query = { _id: { $ne: me }, role: { $in: ['admin', 'team_member'] } }
    } else {
      // student — can only chat with admins
      query = { _id: { $ne: me }, role: 'admin' }
    }

    const users = await User.find(query)
      .select('_id name email role profileImage')
      .sort({ name: 1 })

    // Attach unread counts and last message per contact
    const rooms = await ChatRoom.find({ participants: me })
    const roomMap = {}
    rooms.forEach(r => { roomMap[r.roomId] = r })

    const contacts = users.map(u => {
      const rid  = makeRoomId(me, u._id)
      const room = roomMap[rid]
      return {
        _id:         u._id,
        name:        u.name,
        email:       u.email,
        role:        u.role,
        profileImage:u.profileImage,
        roomId:      rid,
        lastMessage: room?.lastMessage || '',
        lastAt:      room?.lastAt || null,
        unread:      room?.unreadCounts?.get(me.toString()) || 0,
      }
    })

    // Sort: rooms with recent messages first
    contacts.sort((a, b) => {
      if (a.lastAt && b.lastAt) return new Date(b.lastAt) - new Date(a.lastAt)
      if (a.lastAt) return -1
      if (b.lastAt) return 1
      return 0
    })

    res.json(contacts)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET /api/chat/messages/:userId  ──────────────────────────────
// Load last 50 messages between current user and :userId
router.get('/messages/:userId', protect, async (req, res) => {
  try {
    const roomId = makeRoomId(req.user.id, req.params.userId)
    const messages = await ChatMessage.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(50)
    messages.reverse()

    // Mark messages sent by the other user as read
    await ChatMessage.updateMany(
      { roomId, senderId: { $ne: req.user.id }, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    )
    // Clear unread count for me in this room
    await ChatRoom.updateOne(
      { roomId },
      { $set: { [`unreadCounts.${req.user.id}`]: 0 } }
    )

    res.json(messages)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET /api/chat/unread-total  ───────────────────────────────────
// Total unread message count across all rooms (for navbar badge)
router.get('/unread-total', protect, async (req, res) => {
  try {
    const rooms = await ChatRoom.find({ participants: req.user.id })
    let total = 0
    rooms.forEach(r => {
      total += r.unreadCounts?.get(req.user.id.toString()) || 0
    })
    res.json({ count: total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
module.exports.makeRoomId = makeRoomId
