// client/src/pages/InboxPage.js
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
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setConversations(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching inbox:', err);
        setIsLoading(false);
      });
  }, [token, navigate]);

  // CHANGE: handler to delete a chat (for me) from the inbox row
  const handleDeleteChat = async (e, otherUserId) => {
    e.stopPropagation(); // don't trigger row navigation

    // optimistic remove
    setConversations((prev) =>
      prev.filter((c) => String(c.otherUserId) !== String(otherUserId))
    );

    try {
      await fetch('http://localhost:8000/api/chats/clear-for-me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otherUserId }),
      });
    } catch (err) {
      console.error('Failed to delete chat:', err);
      // (Optional) re-fetch to reconcile if you want to roll back
      // const res = await fetch('http://localhost:8000/api/conversations', { headers: { Authorization: `Bearer ${token}` }});
      // setConversations(await res.json());
    }
  };

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4 flex items-center">
          <button onClick={() => navigate(-1)} className="text-purple-600 font-semibold">
            &larr; Back
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">Your Inbox</h1>

        <div className="bg-white rounded-lg shadow-lg">
          {isLoading ? (
            <p className="p-6 text-gray-500">Loading conversations...</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {conversations.length > 0 ? (
                conversations.map((convo) => (
                  <li
                    key={convo.otherUserId}
                    onClick={() =>
                      navigate(`/chat/${convo.otherUserId}`, {
                        state: { sellerName: convo.otherUserName },
                      })
                    }
                    className="p-4 sm:p-6 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div className="pr-4">
                        <p className="font-bold text-lg text-gray-800">{convo.otherUserName}</p>
                        <p className="text-gray-600 truncate">{convo.lastMessageText}</p>
                      </div>

                      {/* CHANGE: Time + Delete chat button group (button sits exactly to the right of time) */}
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-400 self-start">
                          {formatTime(convo.lastMessageDate)}
                        </p>
                        <button
                          onClick={(e) => handleDeleteChat(e, convo.otherUserId)}
                          className="text-red-600 text-sm px-3 py-1 rounded-md hover:bg-red-50 border border-red-200"
                          title="Delete chat (for me)"
                        >
                          Delete chat
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
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
