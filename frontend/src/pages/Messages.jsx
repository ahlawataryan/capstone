import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useSearchParams } from "react-router-dom";
import { getUserByEmail } from "../services/supabaseapi";
import ConversationList from "../components/Messages/ConversationList";
import ConversationView from "../components/Messages/ConversationView";
import NewConversationModal from "../components/Messages/NewConversationModal";
import Navbar from "../components/Navbar";

export default function Messages() {
  const { user } = useAuth0();
  const [searchParams] = useSearchParams();
  const [dbUser, setDbUser] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await getUserByEmail(user.email);
        if (error) throw error;
        setDbUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) fetchUser();
  }, [user]);

  // Handle conversationId from URL parameter
  useEffect(() => {
    const conversationId = searchParams.get('conversationId');
    if (conversationId && dbUser) {
      // Set the selected conversation from URL parameter
      setSelectedConversation({ conversation_id: parseInt(conversationId) });
    }
  }, [searchParams, dbUser]);

  if (loading) return <div className="container py-4">Loading...</div>;

  return (
    <>
      <Navbar/>
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Messages</h2>
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            + New Message
          </button>
        </div>

        <div className="row g-3">
          {/* Conversation list on the left */}
          <div className="col-md-4">
            <ConversationList
              dbUser={dbUser}
              selectedConversation={selectedConversation}
              onSelect={setSelectedConversation}
            />
          </div>

          {/* Message view on the right */}
          <div className="col-md-8">
            {selectedConversation?.conversation_id ? (
              <ConversationView dbUser={dbUser} conversation={selectedConversation} />
            ) : (
              <div className="card h-100">
                <div className="card-body d-flex align-items-center justify-content-center text-muted">
                  Select a conversation to view messages
                </div>
              </div>
            )}
          </div>
        </div>

        {showNewModal && (
          <NewConversationModal
            dbUser={dbUser}
            onClose={() => setShowNewModal(false)}
            onCreated={(conversation) => {
              setSelectedConversation(conversation);
              setShowNewModal(false);
            }}
          />
        )}
      </div>
    </>
  );
}