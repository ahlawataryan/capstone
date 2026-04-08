import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  getUserByEmail,
  getBookingRequestsByClient,
  getBookingRequestsForStudent,
  updateBookingRequestStatus,
  createBooking,
  getBookingsByClient,
  getBookingsForStudent,
  updateBookingStatus,
  createConversation,
  sendMessage,
  createNotification,
} from "../services/supabaseapi";
/*
Component to handle bookings. Very complicated
Handles the basics of bookings like creating and getting
Additionally covers some parts of messaging
*/
const STATUS_BADGE = {
  pending:   "bg-warning text-dark",
  accepted:  "bg-success",
  declined:  "bg-danger",
  cancelled: "bg-secondary",
  confirmed: "bg-success",
  completed: "bg-primary",
};

function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_BADGE[status] ?? "bg-secondary"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function Bookings() {
  const { user } = useAuth0();
  const [searchParams] = useSearchParams();
  const [dbUser, setDbUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [studentBookings, setStudentBookings] = useState([]);

  const [clientSentRequests, setClientSentRequests] = useState([]);
  const [clientBookings, setClientBookings] = useState([]);

  const [activeTab, setActiveTab] = useState("sent");
  const [actionLoading, setActionLoading] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (user?.email) fetchData();
  }, [user]);

  // Handle bookingId and tab navigation from URL parameters
  useEffect(() => {
    if (!loading && dbUser && role) {
      const bookingId = searchParams.get('bookingId');
      const tab = searchParams.get('tab');
      
      if (bookingId) {
        // Find which tab contains this booking and navigate to it
        if (role === 'student') {
          // Check sent requests
          const sentReq = sentRequests.find(r => r.request_id === parseInt(bookingId));
          if (sentReq) {
            setActiveTab('sent');
            return;
          }
          // Check received requests
          const receivedReq = receivedRequests.find(r => r.request_id === parseInt(bookingId));
          if (receivedReq) {
            setActiveTab('received');
            return;
          }
          // Check active bookings
          const booking = studentBookings.find(b => b.bookings_id === parseInt(bookingId));
          if (booking) {
            setActiveTab('active');
            return;
          }
        } else {
          // Client role - check sent requests
          const sentReq = clientSentRequests.find(r => r.request_id === parseInt(bookingId));
          if (sentReq) {
            setActiveTab('sent');
            return;
          }
          // Check active bookings
          const booking = clientBookings.find(b => b.bookings_id === parseInt(bookingId));
          if (booking) {
            setActiveTab('active');
            return;
          }
        }
      } else if (tab) {
        // Navigate to specific tab if provided
        if (role === 'student' && ['sent', 'received', 'active'].includes(tab)) {
          setActiveTab(tab);
        } else if (role === 'client' && ['sent', 'active'].includes(tab)) {
          setActiveTab(tab);
        }
      }
    }
  }, [searchParams, loading, dbUser, role, sentRequests, receivedRequests, studentBookings, clientSentRequests, clientBookings]);

  const fetchData = async () => {
    try {
      /*
      Get user for the following calls. 
      Namely looks for the role
      No in app error handling
      */
      const { data: userData, error: userError } = await getUserByEmail(user.email);
      if (userError) throw userError;
      setDbUser(userData);
      setRole(userData.role);

      if (userData.role === "student") {
        await fetchStudentData(userData.user_id);
        setActiveTab("sent");
      } else {
        await fetchClientData(userData.user_id);
        setActiveTab("sent");
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };
  /*
  Getting booking requests for students
  gets all bookings a client has made,
  all bookings a student has received,
  and all bookings a student has confirmed
  No error handling
  */
  const fetchStudentData = async (userId) => {
    const [sentRes, receivedRes, bookingsAsStudentRes, bookingsAsClientRes] = await Promise.all([
      getBookingRequestsByClient(userId),
      getBookingRequestsForStudent(userId),
      getBookingsForStudent(userId),
      getBookingsByClient(userId),
    ]);
    setSentRequests(sentRes.data || []);
    setReceivedRequests(receivedRes.data || []);
    // Combine bookings where student is both service provider and customer
    const allStudentBookings = [...(bookingsAsStudentRes.data || []), ...(bookingsAsClientRes.data || [])];
    setStudentBookings(allStudentBookings);
  };
  /*
  Get booking requests for clients
  Gets requests made and confirmed
  No error handling
  */
  const fetchClientData = async (userId) => {
    const [sentRes, bookingsRes] = await Promise.all([
      getBookingRequestsByClient(userId),
      getBookingsByClient(userId),
    ]);
    setClientSentRequests(sentRes.data || []);
    setClientBookings(bookingsRes.data || []);
  };

  const handleAction = async (requestId, status) => {
    setActionLoading(requestId + status);
    try {
      //Update status of a booking. Doesn't appear to have an in app error handling
      const { error } = await updateBookingRequestStatus(requestId, status);
      if (error) throw error;

      const req = receivedRequests.find((r) => r.request_id === requestId);

      if (status === "accepted") {
        if (req) {
          let agreedPrice = req.listings?.price_amount ?? 0;
          try {
            const parsed = JSON.parse(req.note || "{}");
            if (parsed.agreed_price != null) agreedPrice = parsed.agreed_price;
          } catch { /* use listing price */ }
          /*
          Creating a booking if a request was accepted
          The parsed part doesn't have a complete catch section
          No in app error handling
          */
          const { error: bookingError } = await createBooking({
            request_id:          req.request_id,
            customer_id:         req.customer_id,
            listing_id:          req.listing_id,
            start_at:            req.requested_start_at,
            end_at:              req.requested_end_at,
            agreed_price_amount: agreedPrice,
          });
          if (bookingError) throw bookingError;

          // Notify the client that their request was accepted
          await createNotification({
            userId: req.customer_id,
            type: "booking_accepted:" + req.request_id,
            message: `Your booking request for "${req.listings?.title}" has been accepted!`,
          });
        }
      }

      if (status === "declined" && req) {
        // Notify the client that their request was declined
        await createNotification({
          userId: req.customer_id,
          type: "booking_declined:" + req.request_id,
          message: `Your booking request for "${req.listings?.title}" has been declined.`,
        });
      }

      if (role === "student") await fetchStudentData(dbUser.user_id);
      else await fetchClientData(dbUser.user_id);
    } catch (err) {
      console.error("Action failed:", err);
      alert("Action failed. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const openCancelModal = (booking) => {
    setCancelModal(booking);
    setCancelReason("");
  };

  const cancelBooking = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      //Cancel booking. No in app error handling
      const { error: cancelError } = await updateBookingStatus(cancelModal.bookings_id, "cancelled");
      if (cancelError) throw cancelError;

      const recipientId = role === "student"
        ? (cancelModal.customer_id === dbUser?.user_id ? cancelModal.listings?.users?.user_id : cancelModal.customer_id)
        : cancelModal.listings?.users?.user_id ?? null;

      if (recipientId) {
        /*
        Create a conversation to cancel a booking. Sends an automated message
        Does not have an in app error handling
        */
        const { data: convo, error: convoError } = await createConversation({
          initiatorUserId: dbUser.user_id,
          recipientUserId: recipientId,
        });
        if (convoError) throw convoError;
        const { error: msgError } = await sendMessage({
          conversationId: convo.conversation_id,
          senderUserId: dbUser.user_id,
          body: `Your booking for "${cancelModal.listings?.title}" has been cancelled.\n\nReason: ${cancelReason.trim()}`,
        });
        if (msgError) throw msgError;

        // Notify the other party
        if (recipientId) {
          const { error: notificationError } = await createNotification({
            userId: recipientId,
            type: `booking_cancelled:${cancelModal.bookings_id}`,
            message: `Your booking for "${cancelModal.listings?.title}" has been cancelled.\n\nReason: ${cancelReason.trim()}`,
          });
          
          if (notificationError) {
            console.error("Failed to create cancellation notification:", notificationError);
          } else {
            console.log("Cancellation notification sent to user:", recipientId);
          }
        } else {
          console.error("No recipient ID found for cancellation notification");
        }
      }

      setCancelModal(null);
      setCancelReason("");
      if (role === "student") await fetchStudentData(dbUser.user_id);
      else await fetchClientData(dbUser.user_id);
    } catch (err) {
      console.error("Cancel failed:", err);
      alert("Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const localStr = dateStr.slice(0, 10).replace(/-/g, "/");
    return new Date(localStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  if (loading) return (
    <>
      <Navbar />
      <div className="container py-4">Loading...</div>
    </>
  );

  const studentTabs = [
    { key: "sent",     label: "Sent Requests",    count: sentRequests.filter((r) => r.status !== "cancelled" && r.status !== "accepted").length },
    { key: "received", label: "Received Requests", count: receivedRequests.filter((r) => r.status === "pending").length },
    { key: "active",   label: "Active Bookings",   count: studentBookings.filter((b) => b.status === "confirmed").length },
  ];

  const clientTabs = [
    { key: "sent",   label: "Sent Requests",   count: clientSentRequests.filter((r) => r.status !== "cancelled" && r.status !== "accepted").length },
    { key: "active", label: "Active Bookings", count: clientBookings.filter((b) => b.status === "confirmed").length },
  ];

  const tabs = role === "student" ? studentTabs : clientTabs;

  return (
    <>
      <Navbar />
      <div className="container py-4">
        <h2 className="mb-4">Bookings</h2>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          {tabs.map((tab) => (
            <li className="nav-item" key={tab.key}>
              <button
                className={`nav-link ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="badge bg-secondary ms-2">{tab.count}</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Sent Requests (both roles) */}
        {activeTab === "sent" && (
          <div>
            <h5 className="mb-3">
              {role === "student" ? "Hire requests you've sent" : "Booking requests you've sent"}
            </h5>
            {(role === "student" ? sentRequests : clientSentRequests).filter((r) => r.status !== "cancelled" && r.status !== "accepted").length === 0 ? (
              <p className="text-muted">No sent requests yet.</p>
            ) : (
              <div className="row g-3">
                {(role === "student" ? sentRequests : clientSentRequests)
                  .filter((r) => r.status !== "cancelled" && r.status !== "accepted")
                  .map((req) => (
                    <div className="col-md-6" key={req.request_id}>
                      <div className="card h-100 shadow-sm">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">{req.listings?.title || "Listing"}</span>
                          <StatusBadge status={req.status} />
                        </div>
                        <div className="card-body">
                          <p className="text-muted small mb-1">
                            Student: {req.listings?.users?.first_name} {req.listings?.users?.last_name}
                          </p>
                          {(() => {
                            try {
                              const parsed = JSON.parse(req.note || "{}");
                              if (parsed.agreed_price != null) return (
                                <p className="text-muted small mb-1">Proposed Price: <strong>${parsed.agreed_price}</strong></p>
                              );
                            } catch { /* show listing rate */ }
                            return <p className="text-muted small mb-1">Listed Rate: ${req.listings?.price_amount}</p>;
                          })()}
                          <p className="text-muted small mb-1">
                            Start: {formatDate(req.requested_start_at)} &rarr; {formatDate(req.requested_end_at)}
                          </p>
                          <p className="text-muted small mb-0">
                            Sent: {formatDate(req.created_at)}
                          </p>
                        </div>
                        {req.status === "pending" && (
                          <div className="card-footer">
                            <button
                              className="btn btn-outline-danger btn-sm w-100"
                              disabled={actionLoading === req.request_id + "cancelled"}
                              onClick={() => handleAction(req.request_id, "cancelled")}
                            >
                              {actionLoading === req.request_id + "cancelled" ? "Cancelling..." : "Cancel Request"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Received requests (students only) */}
        {activeTab === "received" && role === "student" && (
          <div>
            <h5 className="mb-3">Hire requests sent to you</h5>
            {receivedRequests.filter((r) => r.status !== "cancelled" && r.status !== "accepted").length === 0 ? (
              <p className="text-muted">No received requests yet.</p>
            ) : (
              <div className="row g-3">
                {receivedRequests
                  .filter((r) => r.status !== "cancelled" && r.status !== "accepted")
                  .map((req) => (
                    <div className="col-md-6" key={req.request_id}>
                      <div className="card h-100 shadow-sm">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">{req.listings?.title || "Listing"}</span>
                          <StatusBadge status={req.status} />
                        </div>
                        <div className="card-body">
                          <p className="text-muted small mb-1">
                            From: {req.users?.first_name} {req.users?.last_name}
                          </p>
                          {req.users?.email && (
                            <p className="text-muted small mb-1">{req.users.email}</p>
                          )}
                          {(() => {
                            try {
                              const parsed = JSON.parse(req.note || "{}");
                              if (parsed.agreed_price != null) return (
                                <p className="text-muted small mb-1">Proposed Price: <strong>${parsed.agreed_price}</strong></p>
                              );
                            } catch { /* show nothing */ }
                            return null;
                          })()}
                          <p className="text-muted small mb-1">
                            Start: {formatDate(req.requested_start_at)} &rarr; {formatDate(req.requested_end_at)}
                          </p>
                          <p className="text-muted small mb-0">
                            Received: {formatDate(req.created_at)}
                          </p>
                        </div>
                        {req.status === "pending" && (
                          <div className="card-footer d-flex gap-2">
                            <button
                              className="btn btn-success btn-sm flex-fill"
                              disabled={!!actionLoading}
                              onClick={() => handleAction(req.request_id, "accepted")}
                            >
                              {actionLoading === req.request_id + "accepted" ? "Accepting..." : "Accept"}
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm flex-fill"
                              disabled={!!actionLoading}
                              onClick={() => handleAction(req.request_id, "declined")}
                            >
                              {actionLoading === req.request_id + "declined" ? "Declining..." : "Decline"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Active Bookings (both roles) */}
        {activeTab === "active" && (
          <div>
            <h5 className="mb-3">Active bookings</h5>
            {(role === "student" ? studentBookings : clientBookings).filter((b) => b.status === "confirmed").length === 0 ? (
              <p className="text-muted">No active bookings yet.</p>
            ) : (
              <div className="row g-3">
                {(role === "student" ? studentBookings : clientBookings)
                  .filter((b) => b.status === "confirmed")
                  .map((booking) => (
                    <div className="col-md-6" key={booking.bookings_id}>
                      <div className="card h-100 shadow-sm">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">{booking.listings?.title || "Booking"}</span>
                          <StatusBadge status={booking.status} />
                        </div>
                        <div className="card-body">
                          {role === "student" ? (
                            // For students, check if they are the service provider or customer
                            booking.listings?.student_id === dbUser?.user_id ? (
                              <p className="text-muted small mb-1">
                                Client: {booking.users?.first_name} {booking.users?.last_name}
                              </p>
                            ) : (
                              <p className="text-muted small mb-1">
                                Student: {booking.listings?.users?.first_name} {booking.listings?.users?.last_name}
                              </p>
                            )
                          ) : (
                            <p className="text-muted small mb-1">
                              Student: {booking.listings?.users?.first_name} {booking.listings?.users?.last_name}
                            </p>
                          )}
                          <p className="text-muted small mb-1">
                            Agreed Price: ${booking.agreed_price_amount}
                          </p>
                          <p className="text-muted small mb-1">
                            Start: {formatDate(booking.start_at)}
                          </p>
                          <p className="text-muted small mb-0">
                            End: {formatDate(booking.end_at)}
                          </p>
                        </div>
                        <div className="card-footer">
                          <button
                            className="btn btn-outline-danger btn-sm w-100"
                            onClick={() => openCancelModal(booking)}
                          >
                            Cancel Booking
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Cancel Booking Modal */}
        {cancelModal && (
          <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Cancel Booking</h5>
                  <button type="button" className="btn-close" onClick={() => setCancelModal(null)} />
                </div>
                <div className="modal-body">
                  <p className="text-muted small mb-3">
                    Cancelling: <strong>{cancelModal.listings?.title}</strong>
                  </p>
                  <label className="form-label">Reason for cancellation <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Let the other person know why you're cancelling..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <p className="text-muted small mt-2 mb-0">
                    This message will be sent automatically to the other party.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setCancelModal(null)}>
                    Keep Booking
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={!cancelReason.trim() || cancelling}
                    onClick={cancelBooking}
                  >
                    {cancelling ? "Cancelling..." : "Confirm Cancellation"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}