const mongoose = require('mongoose');
const { Schema } = mongoose;

const userRef = { type: Number, ref: 'User', required: true };

// Schema for individual messages
const messageSchema = new Schema({
    senderId: userRef,
    text: {
        type: String,
        required: true,
        trim: true
    },
    listingContext: {
        listingId: { type: Number },
        listingTitle: { type: String }
    }
}, {
    timestamps: true 
});

// NEW: Schema for each participant's status in a conversation
const participantInfoSchema = new Schema({
    userId: userRef,
    deletedAt: { type: Date, default: null } // Tracks when this user deleted the chat
}, { _id: false });


// Updated schema for the main conversation document
const conversationSchema = new Schema({
    // Replaced 'participants' and 'deletedFor' with this more detailed array
    participantsInfo: [participantInfoSchema],
    
    messages: [messageSchema]
}, {
    timestamps: true // This `updatedAt` timestamp is crucial for the logic
});

// Add an index to make finding conversations by user ID faster
conversationSchema.index({ 'participantsInfo.userId': 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = { Conversation };