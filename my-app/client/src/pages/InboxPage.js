import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function InboxPage({ token }) {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchInbox = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/api/inbox`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error('Failed to fetch inbox');
            const data = await response.json();
            setConversations(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchInbox();
    }, [fetchInbox]);

    const handleDelete = async (conversationId, e) => {
        e.stopPropagation(); 
        
        if (!window.confirm("Are you sure you want to hide this chat from your view?")) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:8000/api/conversations/${conversationId}/hide`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete conversation');

            setConversations(prev => prev.filter(convo => convo._id !== conversationId));
        } catch (error) {
            console.error("Error deleting chat:", error);
            alert("Could not delete the chat. Please try again.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-6 py-4">
                    <button onClick={() => navigate('/')} className="text-purple-600 hover:text-purple-800 font-semibold">&larr; Back to Home</button>
                </div>
            </header>
            <main className="container mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">Your Inbox</h1>
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    {isLoading ? <p>Loading conversations...</p> : (
                        <ul className="space-y-4">
                            {conversations.length > 0 ? conversations.map(convo => (
                                <li key={convo._id} onClick={() => navigate(`/inbox/${convo._id}`)}
                                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center group">
                                    <div>
                                        {/* --- THIS IS THE ROBUST FIX --- */}
                                        {/* It checks for the new structure first, then falls back to the old one. */}
                                        <p className="font-bold">
                                            Conversation with Participant IDs: 
                                            {convo.participantsInfo 
                                                ? convo.participantsInfo.map(p => p.userId).join(', ') 
                                                : convo.participants.join(', ')}
                                        </p>
                                        <p className="text-sm text-gray-500 italic mt-1">
                                            Last activity on {new Date(convo.updatedAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDelete(convo._id, e)}
                                        className="bg-red-500 text-white font-bold py-1 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    >
                                        Delete
                                    </button>
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