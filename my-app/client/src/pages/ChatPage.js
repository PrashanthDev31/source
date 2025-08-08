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
    socket.emit("send_message", { otherUserId: sellerId, text: newMessage });
    setMessages((prev) => [
      ...prev,
      { senderId: user?.id, text: newMessage, sentAt: new Date().toISOString() }
    ]);
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
      <header className="bg-purple-600 text-white p-4 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 px-3 py-1 bg-purple-800 rounded hover:bg-purple-900"
        >
          ← Back
        </button>
        <h1 className="font-bold">Chat with {sellerName}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-2 p-2 rounded-lg max-w-sm ${
              msg.senderId === user?.id
                ? "bg-purple-500 text-white ml-auto"
                : "bg-white text-gray-800 mr-auto"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {isTyping && <p className="text-sm italic">Seller is typing...</p>}
        <div ref={messagesEndRef}></div>
      </div>

      <div className="flex p-3 bg-white border-t">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onFocus={handleTyping}
          onBlur={handleStopTyping}
          placeholder="Type your message..."
          className="flex-1 border rounded-lg px-3 py-2 mr-2"
        />
        <button
          onClick={sendMessage}
          disabled={!socket}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatPage;
