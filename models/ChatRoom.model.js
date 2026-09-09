const mongoose = require('mongoose')

// Tracks metadata for each chat room (participants, last message, unread counts)
const chatRoomSchema = new mongoose.Schema(
  {
    roomId:       { type: String, required: true, unique: true }, // "uid1_uid2" sorted
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage:  { type: String, default: '' },
    lastSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastAt:       { type: Date },
    // unreadCounts: { userId: count }
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatRoom', chatRoomSchema)
