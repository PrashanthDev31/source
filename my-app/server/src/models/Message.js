const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    room: String,
    senderId: String,
    receiverId: String,
    text: String,
    deleted: { type: Boolean, default: false },
    hiddenFor: { type: [String], default: [] },
    status: { type: String, default: "sent" }, // sent, delivered, read
    sentAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null }
});

module.exports = mongoose.model("Message", messageSchema);
