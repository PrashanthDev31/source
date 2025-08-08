import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";

function ChatPage() {
  const { sellerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const sellerName = location.state?.sellerName || "Seller";
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const token = localStorage.getItem("token");
  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const s = io("http://localhost:8000", {
      auth: { token }
    });

    setSocket(s);

    s.on("connect", () => {
      s.emit("join_room", { otherUserId: sellerId });
    });

    fetch(`http://localhost:8000/api/messages/${sellerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error("Error loading messages:", err));

    s.on("receive_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    s.on("user_typing", () => setIsTyping(true));
    s.on("user_stop_typing", () => setIsTyping(false));

    return () => {
      s.disconnect();
    };
  }, [sellerId, token, navigate]);

  const sendMessage = () => {
    if (!socket || !newMessage.trim()) return;
    const optimisticMessage = { 
      senderId: user?.id.toString(), // Ensure IDs are strings for comparison
      text: newMessage, 
      sentAt: new Date().toISOString() 
    };
    socket.emit("send_message", { otherUserId: sellerId, text: newMessage });
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
  };

  const handleTyping = () => {
    if (!socket) return;
    socket.emit("typing", { otherUserId: sellerId });
  };

  const handleStopTyping = () => {
    if (!socket) return;
    socket.emit("stop_typing", { otherUserId: sellerId });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-purple-600 text-white p-4 flex items-center shadow-md">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 rounded-full hover:bg-purple-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">{sellerName}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          // --- THIS IS THE CORRECTED SECTION ---
          // Wrap each message in a flex container
          <div key={idx} className={`flex ${msg.senderId == user?.id ? "justify-end" : "justify-start"}`}>
            {/* The message bubble itself */}
            <div
              className={`py-2 px-4 rounded-2xl max-w-md md:max-w-lg ${
                msg.senderId == user?.id
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-800 shadow-sm"
              }`}
            >
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        {isTyping && <p className="text-sm italic text-gray-500">Seller is typing...</p>}
        <div ref={messagesEndRef}></div>
      </div>

      <div className="flex p-3 bg-white border-t border-gray-200">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onFocus={handleTyping}
          onBlur={handleStopTyping}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border rounded-lg px-4 py-2 mr-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={sendMessage}
          disabled={!socket || !newMessage.trim()}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatPage;