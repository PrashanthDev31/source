const mongoose = require('mongoose');
const { Schema } = mongoose;

// We reference the 'User' model, but since we're using Azure SQL for users,
// we will just store the user's SQL ID. We'll name the model 'User' for Mongoose's
// population feature, but we won't create a user schema here.
const userRef = { type: Number, ref: 'User', required: true };

const messageSchema = new Schema({
    senderId: userRef,
    text: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

const conversationSchema = new Schema({
    // An array of the SQL user IDs participating in this conversation.
    participants: [userRef],

    // The SQL ID of the marketplace listing this conversation is about.
    listingId: {
        type: Number,
        required: true
    },
    
    // An array to hold all the messages. This is efficient for fetching a whole conversation.
    messages: [messageSchema]
}, {
    timestamps: true
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = { Conversation };