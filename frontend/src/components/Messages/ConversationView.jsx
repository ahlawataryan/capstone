import { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseconfig";

export default function ConversationView({ dbUser, conversation }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages in real time
    const channel = supabase
      .channel(`conversation-${conversation.conversation_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.conversation_id}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [conversation.conversation_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          message_id,
          body,
          sent_at,
          sender_user_id,
          users!messages_sender_user_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq("conversation_id", conversation.conversation_id)
        .order("sent_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);

    try {
      const { error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.conversation_id,
          sender_user_id: dbUser.user_id,
          body: newMessage.trim(),
          sent_at: new Date().toISOString(),
        });

      if (error) throw error;
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) return <div className="card p-3">Loading messages...</div>;

  return (
    <div className="card d-flex flex-column" style={{ height: "600px" }}>
      <div className="card-header fw-bold">Conversation</div>

      {/* Messages */}
      <div className="card-body overflow-auto flex-grow-1 d-flex flex-column gap-2">
        {messages.length === 0 ? (
          <p className="text-muted">No messages yet. Say hello!</p>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_user_id === dbUser.user_id;
            return (
              <div
                key={msg.message_id}
                className={`d-flex ${isMe ? "justify-content-end" : "justify-content-start"}`}
              >
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
                  <div className={`small mt-1 ${isMe ? "text-white-50" : "text-muted"}`}
                    style={{ fontSize: "11px" }}>
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
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="btn btn-primary"
          onClick={sendMessage}
          disabled={sending || !newMessage.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}