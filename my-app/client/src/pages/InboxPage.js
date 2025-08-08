import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function InboxPage() {
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        fetch('http://localhost:8000/api/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            setConversations(data);
            setIsLoading(false);
        })
        .catch(err => {
            console.error("Error fetching inbox:", err);
            setIsLoading(false);
        });

    }, [token, navigate]);

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-6 py-4 flex items-center">
                    <button onClick={() => navigate(-1)} className="text-purple-600 font-semibold">&larr; Back</button>
                </div>
            </header>
            <main className="container mx-auto px-6 py-12">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">Your Inbox</h1>
                <div className="bg-white rounded-lg shadow-lg">
                    {isLoading ? (
                        <p className="p-6 text-gray-500">Loading conversations...</p>
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {conversations.length > 0 ? conversations.map(convo => (
                                <li key={convo.otherUserId} 
                                    onClick={() => navigate(`/chat/${convo.otherUserId}`, { state: { sellerName: convo.otherUserName } })}
                                    className="p-4 sm:p-6 hover:bg-gray-50 cursor-pointer">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-lg text-gray-800">{convo.otherUserName}</p>
                                            <p className="text-gray-600 truncate">{convo.lastMessageText}</p>
                                        </div>
                                        <p className="text-sm text-gray-400 self-start">
                                            {new Date(convo.lastMessageDate).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </li>
                            )) : (
                                <p className="p-6 text-gray-500">You have no conversations.</p>
                            )}
                        </ul>
                    )}
                </div>
            </main>
        </div>
    );
}

export default InboxPage;