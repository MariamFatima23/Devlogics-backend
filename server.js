// ── Force Google DNS (fixes ISP/local DNS blocking MongoDB SRV) ──
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const jwt       = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// ── HTTP server + Socket.io ──────────────────────────────────────
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || origin.includes('vercel.app') || origin.includes('localhost')) cb(null, true)
      else cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// ── CORS ────────────────────────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true)
    if (
      origin.includes('vercel.app') ||
      origin.includes('localhost')
    ) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

// ── Explicit OPTIONS preflight handler ───────────────────────────
app.options('*', cors())

app.use(express.json())

// ── /uploads handler ─────────────────────────────────────────────
// Cloudinary URLs stored in DB are full https:// URLs.
// If frontend accidentally prefixes them with /uploads/, we redirect.
// Also handles single-slash normalisation: "https:/res..." → "https://res..."
app.use('/uploads', (req, res, next) => {
  const raw = req.path.slice(1); // strip leading '/'

  // Detect embedded full URL — either "https://..." or "https:/..." (browser normalized)
  if (/^https?:\//.test(raw)) {
    // Ensure exactly double slash
    const fixed = raw.replace(/^(https?):\/+/, '$1://');
    return res.redirect(301, fixed);
  }

  // Local dev — serve static files from disk
  if (!process.env.VERCEL) {
    return next();
  }

  return res.status(404).json({ message: 'File not found. Files are served from Cloudinary.' });
});

if (!process.env.VERCEL) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// ── MongoDB connection ───────────────────────────────────────────
async function connectDB() {
  if (mongoose.connection.readyState === 1) return;  // already connected
  if (mongoose.connection.readyState === 2) {         // connecting
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
    });
    return;
  }
  // fresh connect
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 15000,
    maxPoolSize: 5,
  });
  console.log('✅ MongoDB connected');
}

// ── DB middleware — MUST be before routes ────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    res.status(500).json({ message: 'Database connection failed', detail: err.message });
  }
});

// ── Health check ─────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: 'University E-Portal API running' }));

// ── Start cron jobs (production — Heroku/Render keeps process alive) ──
if (process.env.NODE_ENV === 'production') {
  connectDB().then(() => {
    const { startSubscriptionReminderCron } = require('./cron/subscriptionReminder');
    startSubscriptionReminderCron();
  }).catch(() => {});
}

// ── Debug env (remove after fixing) ─────────────────────────────
app.get('/api/debug-env', (req, res) => {
  res.json({
    MONGO_URI_exists: !!process.env.MONGO_URI,
    MONGO_URI_start: process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 30) : 'NOT SET',
    JWT_SECRET_exists: !!process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    mongoose_state: mongoose.connection.readyState,
  });
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth',                require('./routes/auth.routes'))
app.use('/api/users',               require('./routes/user.routes'))
app.use('/api/applications',        require('./routes/application.routes'))
app.use('/api/notifications',       require('./routes/notification.routes'))
app.use('/api/announcements',       require('./routes/announcement.routes'))
app.use('/api/courses',             require('./routes/course.routes'))
app.use('/api/services',            require('./routes/service.routes'))
app.use('/api/hero-slides',         require('./routes/heroslide.routes'))
app.use('/api/course-applications', require('./routes/courseApplication.routes'))
app.use('/api/reviews',             require('./routes/review.routes'))
app.use('/api/student-pride',       require('./routes/studentPride.routes'))
app.use('/api/site-settings',       require('./routes/siteSettings.routes'))
app.use('/api/contact',             require('./routes/contact.routes'))
app.use('/api/leads',               require('./routes/lead.routes'))
app.use('/api/team-members',        require('./routes/teamMember.routes'))
app.use('/api/meetings',            require('./routes/meeting.routes'))
app.use('/api/chat',                require('./routes/chat.routes'))
app.use('/api/finance',            require('./routes/finance.routes'))
app.use('/api/products',           require('./routes/product.routes'))
app.use('/api/clients',            require('./routes/client.routes'))
app.use('/api/subscriptions',      require('./routes/subscription.routes'))
app.use('/api/attendance',         require('./routes/attendance.routes'))

// ── Socket.io — real-time chat ────────────────────────────────────
const ChatMessage = require('./models/ChatMessage.model')
const ChatRoom    = require('./models/ChatRoom.model')
const { makeRoomId } = require('./routes/chat.routes')

// Socket auth middleware — verifies JWT before allowing connection
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) return next(new Error('Authentication required'))
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.user = decoded   // { id, name, role, email, ... }
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

// Map userId → Set of socketIds (one user can have multiple tabs open)
const onlineUsers = new Map()

io.on('connection', (socket) => {
  const userId = socket.user.id.toString()
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set())
  onlineUsers.get(userId).add(socket.id)

  // Broadcast updated online list to everyone
  io.emit('online_users', [...onlineUsers.keys()])

  // ── Join a chat room ──────────────────────────────────────────
  socket.on('join_room', (roomId) => {
    socket.join(roomId)
  })

  // ── Send a message ────────────────────────────────────────────
  socket.on('send_message', async (data) => {
    try {
      const { toUserId, text, fileUrl, fileName } = data
      const roomId = makeRoomId(userId, toUserId)

      // Persist to DB
      const msg = await ChatMessage.create({
        roomId,
        senderId:   socket.user.id,
        senderName: socket.user.name,
        senderRole: socket.user.role,
        text:       text || '',
        fileUrl:    fileUrl || '',
        fileName:   fileName || '',
        readBy:     [socket.user.id],
      })

      // Update / create ChatRoom metadata
      await ChatRoom.findOneAndUpdate(
        { roomId },
        {
          $set: {
            participants:  [socket.user.id, toUserId],
            lastMessage:   text ? (text.length > 80 ? text.slice(0, 80) + '…' : text) : '📎 Attachment',
            lastSenderId:  socket.user.id,
            lastAt:        new Date(),
          },
          $inc: { [`unreadCounts.${toUserId}`]: 1 },
        },
        { upsert: true, new: true }
      )

      // Emit to everyone in the room (sender + receiver)
      io.to(roomId).emit('new_message', msg)

      // If receiver is NOT in the room socket, emit a "chat_notification" event to them directly
      const receiverSockets = onlineUsers.get(toUserId.toString())
      if (receiverSockets) {
        receiverSockets.forEach(sid => {
          const receiverSocket = io.sockets.sockets.get(sid)
          if (receiverSocket && !receiverSocket.rooms.has(roomId)) {
            receiverSocket.emit('chat_notification', {
              from: socket.user.name,
              roomId,
              preview: text ? text.slice(0, 60) : '📎 Attachment',
            })
          }
        })
      }
    } catch (err) {
      socket.emit('error', { message: err.message })
    }
  })

  // ── Typing indicator ──────────────────────────────────────────
  socket.on('typing', ({ toUserId, isTyping }) => {
    const roomId = makeRoomId(userId, toUserId)
    socket.to(roomId).emit('typing', { fromUserId: userId, isTyping })
  })

  // ── Disconnect ────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId)
    if (sockets) {
      sockets.delete(socket.id)
      if (sockets.size === 0) onlineUsers.delete(userId)
    }
    io.emit('online_users', [...onlineUsers.keys()])
  })
})

// ── Local dev server ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      // Start cron jobs after DB is connected
      const { startSubscriptionReminderCron } = require('./cron/subscriptionReminder');
      startSubscriptionReminderCron();
    });
  }).catch((err) => console.error('❌ MongoDB error:', err));
}

module.exports = app;
