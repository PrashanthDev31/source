require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const apiRoutes = require('./src/routes/api'); // existing API routes





// ====== App Setup ======
const app = express();
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use('/api', apiRoutes);

// ====== MongoDB Connection ======
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB for chat'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const Message = require('./src/models/Message');

// ====== HTTP & Socket.io Server ======
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"], credentials: true }
});

let onlineUsers = {};
let lastSeen = {};

// ====== Socket.io Authentication ======
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = user;
    next();
  } catch {
    return next(new Error("Authentication error"));
  }
});

// ====== Socket.io Events ======
io.on("connection", async (socket) => {
  const userId = socket.user.id;
  const username = socket.user.name;
  onlineUsers[userId] = socket.id;

  // Bulk mark undelivered messages as delivered
  const undelivered = await Message.find({
    receiverId: userId,
    status: "sent"
  }).lean();

  if (undelivered.length > 0) {
    const deliveredTime = new Date();
    await Message.updateMany(
      { receiverId: userId, status: "sent" },
      { $set: { status: "delivered", deliveredAt: deliveredTime } }
    );

    const sendersNotified = new Set();
    for (let msg of undelivered) {
      if (onlineUsers[msg.senderId] && !sendersNotified.has(msg.senderId)) {
        io.to(onlineUsers[msg.senderId]).emit("message_status_bulk_update", {
          updatedMessages: undelivered
            .filter(m => m.senderId === msg.senderId)
            .map(m => ({
              id: m._id,
              status: "delivered",
              deliveredAt: deliveredTime
            }))
        });
        sendersNotified.add(msg.senderId);
      }
    }
  }

  io.emit("update_online_users", { online: Object.keys(onlineUsers), lastSeen });

  // Join room
  socket.on("join_room", ({ otherUserId }) => {
    const roomId = [userId, otherUserId].sort().join("_");
    socket.join(roomId);
  });

  // Typing indicators
  socket.on("typing", ({ otherUserId }) => {
    const roomId = [userId, otherUserId].sort().join("_");
    socket.to(roomId).emit("user_typing", username);
  });

  socket.on("stop_typing", ({ otherUserId }) => {
    const roomId = [userId, otherUserId].sort().join("_");
    socket.to(roomId).emit("user_stop_typing", username);
  });

  // Send message
  socket.on("send_message", async ({ otherUserId, text }) => {
    const roomId = [userId, otherUserId].sort().join("_");
    const msg = new Message({
      room: roomId,
      senderId: userId,
      receiverId: otherUserId,
      text,
      sentAt: new Date()
    });
    await msg.save();

    io.to(roomId).emit("receive_message", msg);

    if (onlineUsers[otherUserId]) {
      msg.status = "delivered";
      msg.deliveredAt = new Date();
      await msg.save();
      io.to(socket.id).emit("message_status_updated", {
        id: msg._id, status: "delivered", deliveredAt: msg.deliveredAt
      });
    }
  });

  // Bulk mark as read
  socket.on("mark_chat_as_read", async ({ otherUserId }) => {
    const roomId = [userId, otherUserId].sort().join("_");
    const unread = await Message.find({
      room: roomId,
      receiverId: userId,
      status: "delivered"
    }).lean();

    if (unread.length > 0) {
      const readTime = new Date();
      await Message.updateMany(
        { room: roomId, receiverId: userId, status: "delivered" },
        { $set: { status: "read", readAt: readTime } }
      );

      if (onlineUsers[otherUserId]) {
        io.to(onlineUsers[otherUserId]).emit("message_status_bulk_update", {
          updatedMessages: unread.map(m => ({
            id: m._id, status: "read", readAt: readTime
          }))
        });
      }
    }
  });

  // Soft delete (delete for everyone)
  socket.on("soft_delete_message", async (msgId) => {
    const msg = await Message.findById(msgId);
    if (!msg) return;
    msg.deleted = true;
    msg.text = "This message was deleted";
    await msg.save();
    io.to(msg.room).emit("message_updated", msg);
  });

  // One-sided delete (delete for me)
  socket.on("one_sided_delete", async (msgId) => {
    const msg = await Message.findById(msgId);
    if (!msg) return;
    if (!msg.hiddenFor.includes(userId)) {
      msg.hiddenFor.push(userId);
      await msg.save();
    }
    socket.emit("message_hidden", msgId);
  });

  socket.on("disconnect", () => {
    delete onlineUsers[userId];
    lastSeen[userId] = new Date();
    io.emit("update_online_users", { online: Object.keys(onlineUsers), lastSeen });
  });
});

// ====== Start Server ======
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
