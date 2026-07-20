const ContactMessage = require('../models/ContactMessage.model');

// POST /api/contact  — public, anyone can submit
exports.submitMessage = async (req, res) => {
  try {
    const { fullName, email, course, message } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).json({ message: 'Name, email and message are required.' });
    }

    const doc = await ContactMessage.create({ fullName, email, course, message });
    res.status(201).json({ message: 'Message sent successfully!', data: doc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/contact  — admin only, get all messages
exports.getMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/contact/:id/read  — admin only, mark as read
exports.markRead = async (req, res) => {
  try {
    const msg = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/contact/:id  — admin only
exports.deleteMessage = async (req, res) => {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
