// ChatPage.js (final with presence + read receipts + delete + optimistic reconciliation)
// CHANGE: Presence (online/last seen), read receipts (✓/✓✓), mark_chat_as_read wiring,
// message_status listeners, and keeps actions menu (stopPropagation), optimistic UI.

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";

function ChatPage() {
  const { sellerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const otherUserName = location.state?.sellerName || "User";
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUserId, setTypingUserId] = useState(null);
  const [openActionForId, setOpenActionForId] = useState(null);
  const messagesEndRef = useRef(null);

  // CHANGE: presence + last seen
  const [isPeerOnline, setIsPeerOnline] = useState(false);   // CHANGE
  const [peerLastSeen, setPeerLastSeen] = useState(null);    // CHANGE

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

    // Load history
    fetch(`http://localhost:8000/api/messages/${sellerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        // CHANGE: mark existing delivered messages as read when opening thread
        socket.emit("mark_chat_as_read", { otherUserId: sellerId }); // CHANGE
      })
      .catch((err) => console.error("Error loading messages:", err));

    // Presence updates
    const onPresence = ({ online, lastSeen }) => {            // CHANGE
      const peerIdStr = String(sellerId);
      setIsPeerOnline(online.includes(peerIdStr));
      setPeerLastSeen(lastSeen?.[peerIdStr] ?? null);
    };

    // Receive message (reconcile optimistic via clientId)
    const onReceive = (msg) => {
      setMessages((prev) => {
        if (msg.clientId) {
          const i = prev.findIndex(
            (m) =>
              String(m._id) === String(msg.clientId) ||
              String(m.clientId) === String(msg.clientId)
          );
          if (i !== -1) {
            const next = [...prev];
            next[i] = { ...next[i], ...msg, optimistic: false, _id: msg._id };
            return next;
          }
        }
        return [...prev, msg];
      });
      // CHANGE: if the incoming message is from the peer, mark as read
      const fromPeer = String(msg.senderId) === String(sellerId); // CHANGE
      if (fromPeer) socket.emit("mark_chat_as_read", { otherUserId: sellerId }); // CHANGE
    };

    // When a message is soft-deleted for everyone
    const onMessageUpdated = (updated) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(updated._id) ? { ...m, ...updated } : m
        )
      );
    };

    // When a message is hidden only for me
    const onMessageHidden = (messageId) => {
      setMessages((prev) =>
        prev.filter((m) => String(m._id) !== String(messageId))
      );
    };

    // CHANGE: single-message status update (sent→delivered or read)
    const onMsgStatusUpdated = ({ id, status, deliveredAt, readAt }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(id) ? { ...m, status, deliveredAt, readAt } : m
        )
      );
    };

    // CHANGE: bulk status updates
    const onMsgStatusBulk = ({ updatedMessages }) => {
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [String(m._id), m]));
        updatedMessages.forEach((u) => {
          const key = String(u.id);
          if (map.has(key)) {
            map.set(key, { ...map.get(key), status: u.status, deliveredAt: u.deliveredAt, readAt: u.readAt });
          }
        });
        return Array.from(map.values());
      });
    };

    const onTyping = ({ userId }) => setTypingUserId(userId);
    const onStopTyping = () => setTypingUserId(null);

    socket.on("update_online_users", onPresence);            // CHANGE
    socket.on("receive_message", onReceive);
    socket.on("message_updated", onMessageUpdated);
    socket.on("message_hidden", onMessageHidden);
    socket.on("message_status_updated", onMsgStatusUpdated); // CHANGE
    socket.on("message_status_bulk_update", onMsgStatusBulk);// CHANGE
    socket.on("user_typing", onTyping);
    socket.on("user_stop_typing", onStopTyping);

    return () => {
      socket.off("update_online_users", onPresence);           // CHANGE
      socket.off("receive_message", onReceive);
      socket.off("message_updated", onMessageUpdated);
      socket.off("message_hidden", onMessageHidden);
      socket.off("message_status_updated", onMsgStatusUpdated);// CHANGE
      socket.off("message_status_bulk_update", onMsgStatusBulk);// CHANGE
      socket.off("user_typing", onTyping);
      socket.off("user_stop_typing", onStopTyping);
      socket.disconnect();
    };
  }, [sellerId, token, navigate]);

  const sendMessage = () => {
    const s = socketRef.current;
    if (!s || !newMessage.trim()) return;

    // Optimistic send with clientId
    const clientId = "c-" + Date.now();
    const optimistic = {
      _id: clientId,
      clientId,
      room: [user?.id, sellerId].sort().join("_"),
      senderId: String(user?.id),
      receiverId: String(sellerId),
      text: newMessage,
      sentAt: new Date().toISOString(),
      optimistic: true,
      status: "sent", // CHANGE: show single tick immediately
    };
    setMessages((prev) => [...prev, optimistic]);

    s.emit("send_message", { otherUserId: sellerId, text: newMessage, clientId });
    setNewMessage("");
    s.emit("stop_typing", { otherUserId: sellerId });
  };

  const handleTyping = () =>
    socketRef.current?.emit("typing", { otherUserId: sellerId });
  const handleStopTyping = () =>
    socketRef.current?.emit("stop_typing", { otherUserId: sellerId });

  // Delete for everyone (optimistic + server confirm)
  const deleteForEveryone = (messageId) => {
    setMessages((prev) =>
      prev.map((m) =>
        String(m._id) === String(messageId)
          ? { ...m, deleted: true, text: "This message was deleted" }
          : m
      )
    );
    socketRef.current?.emit("soft_delete_message", messageId);
    setOpenActionForId(null);
  };

  // Delete for me
  const deleteForMe = (messageId) => {
    socketRef.current?.emit("one_sided_delete", messageId);
    setOpenActionForId(null);
  };

  // CHANGE: render ticks for my messages
  const renderTicks = (m) => {
    if (String(m.senderId) !== String(user?.id)) return null;
    const base = "ml-2 text-xs";
    // You can style differently for delivered vs read if desired
    if (m.status === "read") return <span className={base}>✓✓</span>;
    if (m.status === "delivered") return <span className={base}>✓✓</span>;
    return <span className={base}>✓</span>; // sent
  };

  // CHANGE: presence helper
  const renderPresence = () => {
    if (isPeerOnline) return <span className="text-xs text-green-100/90">Online</span>;
    if (peerLastSeen) {
      const d = new Date(peerLastSeen);
      return (
        <span className="text-xs text-white/80">
          Last seen {d.toLocaleString()}
        </span>
      );
    }
    return <span className="text-xs text-white/80">Offline</span>;
  };

  // Actions menu (with stopPropagation so clicks don't bubble to root)
  const MessageActions = ({ msg }) => {
    const isMine = String(msg.senderId) === String(user?.id);
    const canDeleteForEveryone = isMine && !msg.optimistic && !msg.deleted;
    const canDeleteForMe = !msg.optimistic && !msg.deleted;

    const toggleMenu = (e) => {
      e.stopPropagation();
      setOpenActionForId((cur) => (cur === msg._id ? null : msg._id));
    };

    const handleDeleteEveryone = (e) => {
      e.stopPropagation();
      deleteForEveryone(msg._id);
    };

    const handleDeleteMe = (e) => {
      e.stopPropagation();
      deleteForMe(msg._id);
    };

    return (
      <div className="relative">
        <button
          onClick={toggleMenu}
          className={`ml-2 ${isMine ? "text-white/80 hover:text-white" : "text-gray-500 hover:text-gray-700"} transition`}
          title="More"
        >
          •••
        </button>
        {openActionForId === msg._id && (
          <div
            className={`absolute z-10 mt-1 w-44 rounded-md shadow-lg ring-1 ring-black/10
                        ${isMine ? "right-0" : "left-0"} bg-white text-sm`}
            onClick={(e) => e.stopPropagation()}
          >
            <ul className="py-1">
              {canDeleteForEveryone && (
                <li>
                  <button
                    onClick={handleDeleteEveryone}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-red-600"
                  >
                    Delete for everyone
                  </button>
                </li>
              )}
              {canDeleteForMe && (
                <li>
                  <button
                    onClick={handleDeleteMe}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  >
                    Delete for me
                  </button>
                </li>
              )}
              <li>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenActionForId(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    // Clicking outside closes any open menu
    <div
      className="flex flex-col h-screen bg-gray-100"
      onClick={() => setOpenActionForId(null)}
    >
      <header className="bg-purple-600 text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center">
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold">{otherUserName}</h1>
            {/* CHANGE: presence under the name */}
            <div>{renderPresence()}</div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isMine = String(msg.senderId) === String(user?.id);
          const bubbleClasses = isMine
            ? "bg-purple-600 text-white"
            : "bg-white text-gray-800 shadow-sm";
          const rowClasses = isMine ? "justify-end" : "justify-start";

          return (
            <div key={msg._id || idx} className={`flex ${rowClasses}`}>
              <div
                className={`py-2 px-4 rounded-2xl max-w-md ${bubbleClasses}`}
                style={msg.optimistic ? { opacity: 0.6 } : undefined}
              >
                <p>{msg.deleted ? "This message was deleted" : msg.text}</p>
                {/* CHANGE: ticks for my messages */}
                {renderTicks(msg)}
              </div>
              {!msg.deleted && <MessageActions msg={msg} />}
            </div>
          );
        })}

        {/* typing indicator (not me) */}
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
