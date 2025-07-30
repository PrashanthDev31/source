const { Conversation } = require('./src/models/ChatModels');
const express = require("express");
const cors = require("cors");
const http = require('http'); // <-- 1. Import http
const { Server } = require("socket.io"); // <-- 2. Import Server from socket.io
const jwt = require('jsonwebtoken'); // <-- 3. Import jsonwebtoken

const { poolPromise } = require("./src/database/database.js");
const apiRoutes = require('./src/routes/api');
const connectMongo = require('./src/database/mongoConnection');

const app = express();
const httpServer = http.createServer(app); // <-- 4. Create an HTTP server from the Express app

// 5. Initialize Socket.IO server and configure CORS
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000", // Your React app's address
        methods: ["GET", "POST"]
    }
});

// 6. Add Socket.IO Authentication Middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: Token not provided.'));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return next(new Error('Authentication error: Invalid token.'));
        }
        socket.user = user; // Attach user payload to the socket object
        next();
    });
});

// 7. Handle new connections
// Replace the existing io.on('connection',...) block with this
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (Socket ID: ${socket.id})`);

    // Event for a user joining a specific conversation room
    socket.on('join_conversation', (conversationId) => {
        console.log(`User ${socket.user.name} joining conversation ${conversationId}`);
        socket.join(conversationId); // The user's socket joins a room named after the conversation ID
    });

    // Event for a user sending a message
    socket.on('send_message', async ({ conversationId, text }) => {
        try {
            const senderId = socket.user.id;

            // 1. Create the message object
            const message = {
                senderId: senderId,
                text: text,
            };

            // 2. Find the conversation and push the new message
            const updatedConversation = await Conversation.findByIdAndUpdate(
                conversationId,
                { $push: { messages: message } },
                { new: true } // Return the updated document
            );

            if (!updatedConversation) {
                // Handle case where conversation isn't found
                return;
            }

            // The newly added message is the last one in the array
            const newMessage = updatedConversation.messages[updatedConversation.messages.length - 1];

            // 3. Broadcast the new message to all clients in the room
            io.to(conversationId).emit('new_message', newMessage);

        } catch (error) {
            console.error('Error handling send_message event:', error);
            // Optionally emit an error back to the sender
            // socket.emit('message_error', { message: 'Failed to send message.' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.name}`);
    });
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ "message": "Ok, the server is running!" });
});

app.use('/api', apiRoutes);

const HTTP_PORT = 8000;

const startServer = async () => {
    try {
        await poolPromise;
        console.log("Azure SQL Database connection successful.");
        await connectMongo();

        console.log("Databases connected. Starting server...");
        // 8. Use httpServer to listen instead of app
        httpServer.listen(HTTP_PORT, () => {
            console.log(`Server running on http://localhost:${HTTP_PORT}`);
        });
    } catch (err) {
        console.error("Failed to connect to a database. Server will not start.");
        console.error(err);
        process.exit(1);
    }
};

startServer();