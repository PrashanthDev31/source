// server.js — Delete Chat = for current user only (WhatsApp-style)
// Keeps your existing features; removes any "delete for everyone (entire chat)" behavior

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const apiRoutes = require('./src/routes/api');

const app = express();
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use('/api', apiRoutes);

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB for chat'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const Message = require('./src/models/Message');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"], credentials: true }
});

let onlineUsers = {};
let lastSeen = {};

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication error"));
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = user;
    next();
  } catch {
    return next(new Error("Authentication error"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.user.id.toString();
  onlineUsers[userId] = socket.id;

  // Mark pending "sent" as "delivered" on receiver connect
  try {
    const undelivered = await Message.find({ receiverId: userId, status: "sent" }).lean();
    if (undelivered.length > 0) {
      const deliveredTime = new Date();
      await Message.updateMany(
        { receiverId: userId, status: "sent" },
        { $set: { status: "delivered", deliveredAt: deliveredTime } }
      );
      const notify = new Set();
      for (let m of undelivered) {
        if (onlineUsers[m.senderId] && !notify.has(m.senderId)) {
          io.to(onlineUsers[m.senderId]).emit("message_status_bulk_update", {
            updatedMessages: undelivered
              .filter(x => x.senderId === m.senderId)
              .map(x => ({ id: x._id, status: "delivered", deliveredAt: deliveredTime }))
          });
          notify.add(m.senderId);
        }
      }
    }
  } catch (e) {
    console.error('deliver pending error:', e);
  }

  io.emit("update_online_users", { online: Object.keys(onlineUsers), lastSeen });

  socket.on("join_room", ({ otherUserId }) => {
    const roomId = [userId, otherUserId.toString()].sort().join("_");
    socket.join(roomId);
  });

  socket.on("typing", ({ otherUserId }) => {
    const roomId = [userId, otherUserId.toString()].sort().join("_");
    socket.to(roomId).emit("user_typing", { userId });
  });

  socket.on("stop_typing", ({ otherUserId }) => {
    const roomId = [userId, otherUserId.toString()].sort().join("_");
    socket.to(roomId).emit("user_stop_typing");
  });

  socket.on("send_message", async ({ otherUserId, text, clientId }) => {
    try {
      const otherUserIdStr = otherUserId.toString();
      const roomId = [userId, otherUserIdStr].sort().join("_");
      if (![...socket.rooms].includes(roomId)) socket.join(roomId);

      const msg = new Message({
        room: roomId,
        senderId: userId,
        receiverId: otherUserIdStr,
        text,
        sentAt: new Date()
      });
      await msg.save();

      const out = { ...msg.toObject(), clientId };
      io.to(roomId).emit("receive_message", out);

      if (onlineUsers[otherUserIdStr]) {
        msg.status = "delivered";
        msg.deliveredAt = new Date();
        await msg.save();
        io.to(socket.id).emit("message_status_updated", {
          id: msg._id, status: "delivered", deliveredAt: msg.deliveredAt
        });
      }
    } catch (e) {
      console.error('send_message error:', e);
      socket.emit("chat:error", { message: "Failed to send message" });
    }
  });

  // Per-message: delete for everyone (soft delete) — kept as before
  socket.on("soft_delete_message", async (msgId) => {
    try {
      const msg = await Message.findById(msgId);
      if (!msg) return;
      msg.deleted = true;
      msg.text = "This message was deleted";
      await msg.save();
      const update = { _id: String(msg._id), deleted: true, text: "This message was deleted" };
      io.to(msg.room).emit("message_updated", update);
    } catch (e) {
      console.error('soft_delete_message error:', e);
    }
  });

  // Per-message: delete for me (one-sided)
  socket.on("one_sided_delete", async (msgId) => {
    try {
      const msg = await Message.findById(msgId);
      if (!msg) return;
      if (!msg.hiddenFor.includes(userId)) {
        msg.hiddenFor.push(userId);
        await msg.save();
      }
      socket.emit("message_hidden", msgId);
    } catch (e) {
      console.error('one_sided_delete error:', e);
    }
  });

  // ✅ ONLY OPTION: Delete chat (for me) — hides all messages in this room for current user
  socket.on("clear_chat_for_me", async ({ otherUserId }) => {
    try {
      const roomId = [userId, String(otherUserId)].sort().join("_");
      await Message.updateMany(
        { room: roomId, hiddenFor: { $ne: userId } },
        { $push: { hiddenFor: userId } }
      );
      socket.emit("chat_cleared_for_me", { roomId });
    } catch (e) {
      console.error('clear_chat_for_me error:', e);
      socket.emit("chat:error", { message: "Failed to delete chat" });
    }
  });

  socket.on("mark_chat_as_read", async ({ otherUserId }) => {
    try {
      const roomId = [userId, otherUserId].sort().join("_");
      const unread = await Message.find({
        room: roomId, receiverId: userId, status: "delivered"
      }).lean();

      if (unread.length > 0) {
        const readTime = new Date();
        await Message.updateMany(
          { room: roomId, receiverId: userId, status: "delivered" },
          { $set: { status: "read", readAt: readTime } }
        );
        if (onlineUsers[otherUserId]) {
          io.to(onlineUsers[otherUserId]).emit("message_status_bulk_update", {
            updatedMessages: unread.map(m => ({ id: m._id, status: "read", readAt: readTime }))
          });
        }
      }
    } catch (e) {
      console.error('mark_chat_as_read error:', e);
    }
  });

  socket.on("disconnect", () => {
    delete onlineUsers[userId];
    lastSeen[userId] = new Date();
    io.emit("update_online_users", { online: Object.keys(onlineUsers), lastSeen });
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
