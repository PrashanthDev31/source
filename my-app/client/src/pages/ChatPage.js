import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

function ChatPage({ token, user }) {
    const navigate = useNavigate();
    const { conversationId } = useParams();
    const location = useLocation();
    const listingContext = location.state?.listingContext;
    
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    useEffect(() => {
        if (!token || !conversationId) return;

        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`http://localhost:8000/api/conversations/${conversationId}/messages`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch messages');
                const data = await response.json();
                setMessages(data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMessages();

        socketRef.current = io('http://localhost:8000', { auth: { token } });
        const socket = socketRef.current;
        socket.on('connect', () => {
            socket.emit('join_conversation', conversationId);
        });
        socket.on('new_message', (incomingMessage) => {
            setMessages(prevMessages => [...prevMessages, incomingMessage]);
        });
        
        return () => { socket.disconnect(); };
    }, [token, conversationId]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && socketRef.current) {
            const lastMessage = messages[messages.length - 1];
            const shouldSendContext = listingContext && (!lastMessage || !lastMessage.listingContext || lastMessage.listingContext.listingId !== listingContext.listingId);

            socketRef.current.emit('send_message', {
                conversationId: conversationId,
                text: newMessage,
                listingContext: shouldSendContext ? listingContext : null
            });
            setNewMessage('');
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <header className="bg-white shadow-sm sticky top-0">
                <div className="container mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => navigate('/inbox')} className="text-purple-600 hover:text-purple-800 font-semibold">&larr; Back to Inbox</button>
                    <h1 className="text-xl font-bold text-gray-800">Chat</h1>
                </div>
            </header>
            <main className="flex-grow container mx-auto px-6 py-8 flex flex-col">
                <div className="bg-white p-4 rounded-lg shadow-lg flex-grow space-y-2 overflow-y-auto">
                    {isLoading ? <p>Loading messages...</p> : messages.map((msg, index) => (
                        <React.Fragment key={msg._id || index}>
                            {msg.listingContext && (
                                <div className="text-center my-4">
                                    <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                                        Conversation started about: <strong>{msg.listingContext.listingTitle}</strong>
                                    </span>
                                </div>
                            )}
                            <div className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${msg.senderId === user.id ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                    <p>{msg.text}</p>
                                </div>
                            </div>
                        </React.Fragment>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="mt-4 flex gap-4">
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type a message..." className="flex-grow p-3 border rounded-lg shadow-sm" />
                    <button type="submit" className="py-3 px-6 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700">Send</button>
                </form>
            </main>
        </div>
    );
}

export default ChatPage;