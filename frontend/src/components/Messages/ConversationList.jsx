import { useState, useEffect } from "react";
import { supabase } from "../../supabaseconfig";

export default function ConversationList({ dbUser, selectedConversation, onSelect }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        // Fetch conversations that have messages involving this user
        const { data, error } = await supabase
          .from("conversations")
          .select(`
            conversation_id,
            created_at,
            messages (
              message_id,
              body,
              sent_at,
              sender_user_id,
              users!messages_sender_user_id_fkey (
                first_name,
                last_name
              )
            )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Only show conversations where the user has sent or received a message
        const userConversations = (data || []).filter(c =>
          c.messages?.some(m => m.sender_user_id === dbUser.user_id)
        );

        setConversations(userConversations);
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      } finally {
        setLoading(false);
      }
    };

    if (dbUser) fetchConversations();
  }, [dbUser]);

  const getLastMessage = (conversation) => {
    const msgs = conversation.messages ?? [];
    if (!msgs.length) return "No messages yet";
    const last = msgs.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
    return last.body.length > 50 ? last.body.slice(0, 50) + "..." : last.body;
  };

  const getOtherParticipant = (conversation) => {
    const otherMsg = conversation.messages?.find(
      m => m.sender_user_id !== dbUser.user_id
    );
    if (!otherMsg) return "Unknown";
    return `${otherMsg.users?.first_name} ${otherMsg.users?.last_name}`;
  };

  if (loading) return <div className="card p-3">Loading conversations...</div>;

  return (
    <div className="card">
      <div className="card-header fw-bold">Conversations</div>
      {conversations.length === 0 ? (
        <div className="card-body text-muted">No conversations yet.</div>
      ) : (
        <div className="list-group list-group-flush">
          {conversations.map(c => (
            <button
              key={c.conversation_id}
              className={`list-group-item list-group-item-action ${
                selectedConversation?.conversation_id === c.conversation_id ? "active" : ""
              }`}
              onClick={() => onSelect(c)}
            >
              <div className="fw-bold small">{getOtherParticipant(c)}</div>
              <div className="text-muted small">{getLastMessage(c)}</div>
              <div className="text-muted" style={{ fontSize: "11px" }}>
                {new Date(c.created_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}