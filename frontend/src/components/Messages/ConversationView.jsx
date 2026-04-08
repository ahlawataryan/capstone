import { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseconfig";
import {
  getMessagesForConversation,
  sendMessage,
  createNotification,
} from "../../services/supabaseapi";
/*
Component for message view. Handles formatting of messages to send them
*/
export default function ConversationView({ dbUser, conversation }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!conversation?.conversation_id) return;

    setMessages([]);
    setLoading(true);
    fetchMessages();

        // Subscribe to new messages in real time
    const channel = supabase
      .channel(`conversation-${conversation.conversation_id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversation.conversation_id}`,
      }, (payload) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.message_id === payload.new.message_id);
          if (exists) return prev;
          const withoutOptimistic = prev.filter(
            (m) => !(m._optimistic && m.body === payload.new.body && m.sender_user_id === payload.new.sender_user_id)
          );
          return [...withoutOptimistic, payload.new];
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [conversation?.conversation_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      /*
        Get messages given a conversation. Different from the List file just getting the conversation
        Does not provide an in app error message
      */
      const { data, error } = await getMessagesForConversation(conversation.conversation_id);
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const body = newMessage.trim();
    const optimisticId = `optimistic-${Date.now()}`;

    setMessages((prev) => [...prev, {
      message_id: optimisticId,
      conversation_id: conversation.conversation_id,
      sender_user_id: dbUser.user_id,
      body,
      sent_at: new Date().toISOString(),
      _optimistic: true,
    }]);
    setNewMessage("");
    setSending(true);

    try {
      /*
      Send a message using the conversation id
      Has some handling of errors to keep the message
      I truly don't know what the alert function is. I think it's a popup
      */
      const { error } = await sendMessage({
        conversationId: conversation.conversation_id,
        senderUserId: dbUser.user_id,
        body,
      });
      if (error) throw error;

      // Notify the other participant
      const recipientId =
        conversation.initiator_user_id === dbUser.user_id
          ? conversation.recipient_user_id
          : conversation.initiator_user_id;

      if (recipientId && recipientId !== dbUser.user_id) {
        await createNotification({ userId: recipientId, type: "message:" + conversation.conversation_id, message: "You have a new message from " + dbUser.first_name + " " + dbUser.last_name });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => prev.filter((m) => m.message_id !== optimisticId));
      setNewMessage(body);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (!conversation?.conversation_id) return <div className="card p-3">Select a conversation.</div>;
  if (loading) return <div className="card p-3">Loading messages...</div>;

  return (
    <div className="card d-flex flex-column" style={{ height: "600px" }}>
      <div className="card-header fw-bold">Conversation</div>

      {/* Messages */}
      <div className="card-body overflow-auto flex-grow-1 d-flex flex-column gap-2">
        {messages.length === 0 ? (
          <p className="text-muted">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_user_id === dbUser.user_id;
            return (
              <div key={msg.message_id} className={`d-flex ${isMe ? "justify-content-end" : "justify-content-start"}`}>
                <div
                  className={`p-2 rounded-3 ${isMe ? "bg-primary text-white" : "bg-light"}`}
                  style={{ maxWidth: "70%" }}
                >
                  {!isMe && (
                    <div className="fw-bold small mb-1">
                      {msg.users?.first_name} {msg.users?.last_name}
                    </div>
                  )}
                  <div>{msg.body}</div>
                  <div className={`small mt-1 ${isMe ? "text-white-50" : "text-muted"}`} style={{ fontSize: "11px" }}>
                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      
      {/* Input */}
      <div className="card-footer d-flex gap-2">
        <textarea
          className="form-control"
          rows={2}
          placeholder="Type a message... (Enter to send)"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={sending || !newMessage.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}