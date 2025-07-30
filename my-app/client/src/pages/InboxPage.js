import React, { useState, useEffect } from 'react';

function InboxPage({ onNavigate, token }) {
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInbox = async () => {
            if (!token) return;
            try {
                const response = await fetch('http://localhost:8000/api/inbox', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch inbox');
                const data = await response.json();
                setConversations(data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInbox();
    }, [token]);

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-6 py-4">
                    <button onClick={() => onNavigate('home')} className="text-purple-600 hover:text-purple-800 font-semibold">&larr; Back to Home</button>
                </div>
            </header>
            <main className="container mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">Your Inbox</h1>
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    {isLoading ? <p>Loading conversations...</p> : (
                        <ul className="space-y-4">
                            {conversations.length > 0 ? conversations.map(convo => (
                                <li key={convo._id} onClick={() => onNavigate('chat', { conversationId: convo._id })}
                                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <p className="font-bold">Conversation regarding Listing ID: {convo.listingId}</p>
                                    <p className="text-sm text-gray-500">
                                        Participants: {convo.participants.join(', ')}
                                    </p>
                                    <p className="text-sm text-gray-500 italic mt-1">
                                        Last message on {new Date(convo.updatedAt).toLocaleString()}
                                    </p>
                                </li>
                            )) : <p>You have no conversations.</p>}
                        </ul>
                    )}
                </div>
            </main>
        </div>
    );
}

export default InboxPage;