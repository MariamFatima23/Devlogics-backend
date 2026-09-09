const ContactMessage = require('../models/ContactMessage.model');
const { sendEmail } = require('../utils/email');

const buildContactAutoReply = ({ fullName, course }) => {
  const courseLine = course ? `Aap ne <strong>${course}</strong> ke baare mein inquiry ki thi.` : 'Aap ne course inquiry bheji hai.';
  return {
    subject: 'DevLogics Skill Center — Inquiry Received',
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6;">
        <p>Assalam-o-Alaikum ${fullName || 'Student'},</p>
        <p>DevLogics Skill Center se aapki inquiry receive ho gayi hai.</p>
        <p>${courseLine} Hum aapko jald se jald course content, timing, fees aur admission process ki poori detail bhejenge.</p>
        <h3>📅 Meeting Details:</h3>
        <ul>
          <li>Date: [Date]</li>
          <li>Time: [Time]</li>
          <li>Mode: [Online/Onsite]</li>
          <li>Link: [Meeting Link, agar online ho]</li>
        </ul>
        <p>Agar ye time aapke liye theek nahi hai, please bata dein — hum aapke liye koi aur time adjust kar dete hain.</p>
        <p>Shukriya! 😊<br/>DevLogics Skill Center</p>
      </div>
    `,
    text: `Assalam-o-Alaikum ${fullName || 'Student'},

DevLogics Skill Center se aapki inquiry receive ho gayi hai.

${courseLine} Hum aapko jald se jald course content, timing, fees aur admission process ki poori detail bhejenge.

Meeting Details:
Date: [Date]
Time: [Time]
Mode: [Online/Onsite]
Link: [Meeting Link, agar online ho]

Agar ye time aapke liye theek nahi hai, please bata dein — hum aapke liye koi aur time adjust kar dete hain.

Shukriya! 😊
DevLogics Skill Center`,
  };
};

// POST /api/contact  — public, anyone can submit
exports.submitMessage = async (req, res) => {
  try {
    const { fullName, email, course, message } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).json({ message: 'Name, email and message are required.' });
    }

    const doc = await ContactMessage.create({ fullName, email, course, message });

    try {
      const autoReply = buildContactAutoReply({ fullName, course });
      await sendEmail(email, autoReply.subject, autoReply.html, autoReply.text);
    } catch (emailErr) {
      console.error('Auto-reply email failed:', emailErr.message);
    }

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
