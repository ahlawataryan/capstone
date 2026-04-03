import { useState, useEffect } from "react";
import {
  getAllUsers,
  createConversation,
  sendMessage,
  createNotification,
} from "../../services/supabaseapi";
/*
Component for initializing conversations and sending an initial method
NOTE: Look over the getAllUsers part for establishing conversations
Likely want a more specialized api call for this while restricting the number
of users retrieved to ones with bookings
*/
export default function NewConversationModal({ dbUser, onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    /*
    Gets all users and attempts to use a filter to limit the number. Only filters self
    May want to implement a getManyUsers function in the future
    Best option is to only be able to message from bookings
    Does not provide an in app error
    */
    getAllUsers().then(({ data, error }) => {
      if (!error) setUsers((data || []).filter((u) => u.user_id !== dbUser.user_id));
      setLoading(false);
    });
  }, [dbUser]);

  const handleStart = async () => {
    if (!selectedUser || !firstMessage.trim()) return;
    setSending(true);

    try {
      // Create conversation - alert error handling. Minimal
      const { data: convo, error: convoError } = await createConversation({
        initiatorUserId: dbUser.user_id,
        recipientUserId: parseInt(selectedUser),
      });
      if (convoError) throw convoError;
      if (!convo?.conversation_id) throw new Error("No conversation ID returned");

      // Send first message - alert error handling. Minimal
      const { error: msgError } = await sendMessage({
        conversationId: convo.conversation_id,
        senderUserId: dbUser.user_id,
        body: firstMessage.trim(),
      });

      if (msgError) throw msgError;

      // Notify the recipient
      await createNotification({ userId: parseInt(selectedUser), type: "message" });

      onCreated(convo);
    } catch (err) {
      console.error("Failed to create conversation:", err);
      alert("Failed to start conversation.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}>
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
                  <select className="form-select" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                    <option value="">Select a user...</option>
                    {users.map((u) => (
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
                    onChange={(e) => setFirstMessage(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
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