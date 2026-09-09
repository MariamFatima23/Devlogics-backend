const mongoose = require('mongoose')

// A "room" is identified by a sorted pair of userIds: `userId1_userId2`
// For group rooms (future), roomId can be any string.

const chatMessageSchema = new mongoose.Schema(
  {
    roomId:     { type: String, required: true, index: true }, // e.g. "uid1_uid2"
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String },
    text:       { type: String, default: '' },
    fileUrl:    { type: String, default: '' },    // optional attachment
    fileName:   { type: String, default: '' },
    readBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

chatMessageSchema.index({ roomId: 1, createdAt: 1 })

module.exports = mongoose.model('ChatMessage', chatMessageSchema)
