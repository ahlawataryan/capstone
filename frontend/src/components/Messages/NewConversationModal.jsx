import { useState, useEffect } from "react";
import { supabase } from "../../supabaseconfig";

export default function NewConversationModal({ dbUser, onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("user_id, first_name, last_name, role")
          .neq("user_id", dbUser.user_id);

        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [dbUser]);

  const handleStart = async () => {
    if (!selectedUser || !firstMessage.trim()) return;
    setSending(true);

    try {
      // Create conversation
      const { data: convo, error: convoError } = await supabase
        .from("conversations")
        .insert({ request_id: null, booking_id: null })
        .select()
        .single();

      if (convoError) throw convoError;

      // Send first message
      const { error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: convo.conversation_id,
          sender_user_id: dbUser.user_id,
          body: firstMessage.trim(),
          sent_at: new Date().toISOString(),
        });

      if (msgError) throw msgError;

      onCreated(convo);
    } catch (err) {
      console.error("Failed to create conversation:", err);
      alert("Failed to start conversation.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="modal fade show"
      style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">New Message</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body">
            {loading ? (
              <p>Loading users...</p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="form-label">Send to</label>
                  <select
                    className="form-select"
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                  >
                    <option value="">Select a user...</option>
                    {users.map(u => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.first_name} {u.last_name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Type your message..."
                    value={firstMessage}
                    onChange={e => setFirstMessage(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!selectedUser || !firstMessage.trim() || sending}
              onClick={handleStart}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}