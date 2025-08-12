// ChatPage.js
// CHANGE: add clientId-based optimistic UI with reconciliation (no duplicates).
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";

function ChatPage() {
  const { sellerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const otherUserName = location.state?.sellerName || "User";
  const socketRef = useRef(null); // (kept) useRef for socket
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUserId, setTypingUserId] = useState(null);
  const messagesEndRef = useRef(null);

  const token = localStorage.getItem("token");
  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUserId]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const socket = io("http://localhost:8000", { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_room", { otherUserId: sellerId });
    });

    // initial history
    fetch(`http://localhost:8000/api/messages/${sellerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error("Error loading messages:", err));

    // CHANGE: reconcile echoed messages using clientId (replace optimistic, don't append)
    const onReceive = (msg) => {
      setMessages((prev) => {
        if (msg.clientId) {
          const i = prev.findIndex(
            (m) =>
              String(m._id) === String(msg.clientId) ||
              String(m.clientId) === String(msg.clientId)
          );
          if (i !== -1) {
            const copy = [...prev];
            copy[i] = { ...copy[i], ...msg, optimistic: false, _id: msg._id };
            return copy;
          }
        }
        return [...prev, msg];
      });
    };

    const onTyping = ({ userId }) => setTypingUserId(userId);
    const onStopTyping = () => setTypingUserId(null);

    socket.on("receive_message", onReceive);
    socket.on("user_typing", onTyping);
    socket.on("user_stop_typing", onStopTyping);

    return () => {
      socket.off("receive_message", onReceive);
      socket.off("user_typing", onTyping);
      socket.off("user_stop_typing", onStopTyping);
      socket.disconnect();
    };
  }, [sellerId, token, navigate]);

  const sendMessage = () => {
    const s = socketRef.current;
    if (!s || !newMessage.trim()) return;

    // CHANGE: create a clientId and use it for optimistic message & reconciliation
    const clientId = "c-" + Date.now();

    const optimistic = {
      _id: clientId, // CHANGE: temporary id equals clientId
      clientId, // CHANGE: carry clientId
      room: [user?.id, sellerId].sort().join("_"),
      senderId: String(user?.id),
      receiverId: String(sellerId),
      text: newMessage,
      sentAt: new Date().toISOString(),
      optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    // CHANGE: include clientId in emit so server echoes it back
    s.emit("send_message", { otherUserId: sellerId, text: newMessage, clientId });
    setNewMessage("");
    s.emit("stop_typing", { otherUserId: sellerId });
  };

  const handleTyping = () =>
    socketRef.current?.emit("typing", { otherUserId: sellerId });
  const handleStopTyping = () =>
    socketRef.current?.emit("stop_typing", { otherUserId: sellerId });

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-purple-600 text-white p-4 flex items-center shadow-md">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 rounded-full hover:bg-purple-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <h1 className="text-xl font-bold">{otherUserName}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={msg._id || idx}
            className={`flex ${
              String(msg.senderId) === String(user?.id)
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`py-2 px-4 rounded-2xl max-w-md ${
                String(msg.senderId) === String(user?.id)
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-800 shadow-sm"
              }`}
              style={msg.optimistic ? { opacity: 0.6 } : undefined}
            >
              <p>{msg.text}</p>
            </div>
          </div>
        ))}

        {typingUserId && String(typingUserId) !== String(user?.id) && (
          <div className="flex justify-start">
            <div className="py-2 px-4 rounded-2xl bg-white text-gray-500 shadow-sm">
              <p className="italic">{otherUserName} is typing...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex p-3 bg-white border-t">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onFocus={handleTyping}
          onBlur={handleStopTyping}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border rounded-lg px-4 py-2 mr-3"
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatPage;
