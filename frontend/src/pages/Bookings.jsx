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
  createPayment,
  getBookingsByClient,
  getBookingsForStudent,
  updateBookingStatus,
  createConversation,
  sendMessage,
  createNotification,
  deactivateListing,
  getNotificationsForUser,
  markNotificationCleared,
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

  // Modal that asks the student whether to keep the listing open for others
  // or deactivate it when they accept a hire request.
  const [acceptModal, setAcceptModal] = useState(null);
  const [keepListingActive, setKeepListingActive] = useState(true);

  // For bookings to be completed and notifications to be sent on completion
  const [completionNotifications, setCompletionNotifications] = useState([]);
  const [completeModal, setCompleteModal] = useState(null);
  const [completing, setCompleting] = useState(false);

  // past bookings and requests can be cleared by the user to hide them from the history tab.
  const [clearedItems, setClearedItems] = useState(() => new Set());
  const [sentCompletionRequests, setSentCompletionRequests] = useState(() => new Set());

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load data on mount
  useEffect(() => {
    if (user?.email) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  useEffect(() => {
    if (!dbUser?.user_id) return;
    try {
      const raw = localStorage.getItem(`clearedPastItems_${dbUser.user_id}`);
      if (raw) setClearedItems(new Set(JSON.parse(raw)));
      else setClearedItems(new Set());
    } catch {
      setClearedItems(new Set());
    }
    try {
      const raw = localStorage.getItem(`sentCompletionRequests_${dbUser.user_id}`);
      if (raw) setSentCompletionRequests(new Set(JSON.parse(raw)));
      else setSentCompletionRequests(new Set());
    } catch {
      setSentCompletionRequests(new Set());
    }
  }, [dbUser?.user_id]);

  // Handle bookingId and tab navigation from URL parameters
  useEffect(() => {
    if (!loading && dbUser && role) {
      const bookingId = searchParams.get('bookingId');
      const tab = searchParams.get('tab');

      if (bookingId) {
        // Find which tab contains this booking/request and navigate to it.
        const id = parseInt(bookingId);
        const tabForRequest = (req) =>
          (req.status === 'cancelled' || req.status === 'declined') ? 'history' : null;
        const tabForBooking = (booking) =>
          (booking.status === 'completed' || booking.status === 'cancelled') ? 'history' : 'active';

        if (role === 'student') {
          // Check sent requests
          const sentReq = sentRequests.find(r => r.request_id === id);
          if (sentReq) {
            setActiveTab(tabForRequest(sentReq) ?? 'sent');
            return;
          }
          // Check received requests
          const receivedReq = receivedRequests.find(r => r.request_id === id);
          if (receivedReq) {
            setActiveTab(tabForRequest(receivedReq) ?? 'received');
            return;
          }
          // Check active bookings
          const booking = studentBookings.find(b => b.bookings_id === id);
          if (booking) {
            setActiveTab(tabForBooking(booking));
            return;
          }
        } else {
          // Client role - check sent requests
          const sentReq = clientSentRequests.find(r => r.request_id === id);
          if (sentReq) {
            setActiveTab(tabForRequest(sentReq) ?? 'sent');
            return;
          }
          // Check active bookings
          const booking = clientBookings.find(b => b.bookings_id === id);
          if (booking) {
            setActiveTab(tabForBooking(booking));
            return;
          }
        }
      } else if (tab) {
        // Navigate to specific tab if provided
        if (role === 'student' && ['sent', 'received', 'active', 'history'].includes(tab)) {
          setActiveTab(tab);
        } else if (role === 'client' && ['sent', 'active', 'history'].includes(tab)) {
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
    const [sentRes, receivedRes, providerBookingsRes, customerBookingsRes, notificationsRes] = await Promise.all([
      getBookingRequestsByClient(userId),
      getBookingRequestsForStudent(userId),
      getBookingsForStudent(userId),
      getBookingsByClient(userId),
      getNotificationsForUser(userId),
    ]);
    setSentRequests(sentRes.data || []);
    setReceivedRequests(receivedRes.data || []);
    // Merge bookings where student is the provider (their listing was booked)
    // with bookings where student is the customer (they hired someone else)
    const mergedById = new Map();
    for (const b of (providerBookingsRes.data || [])) mergedById.set(b.bookings_id, b);
    for (const b of (customerBookingsRes.data || [])) mergedById.set(b.bookings_id, b);
    setStudentBookings([...mergedById.values()]);
    setCompletionNotifications(
      (notificationsRes.data || []).filter(n => (n.type || "").startsWith("completion_request:"))
    );
  };
  /*
  Get booking requests for clients
  Gets requests made and confirmed
  No error handling
  */
  const fetchClientData = async (userId) => {
    const [sentRes, bookingsRes, notificationsRes] = await Promise.all([
      getBookingRequestsByClient(userId),
      getBookingsByClient(userId),
      getNotificationsForUser(userId),
    ]);
    setClientSentRequests(sentRes.data || []);
    setClientBookings(bookingsRes.data || []);
    setCompletionNotifications(
      (notificationsRes.data || []).filter(n => (n.type || "").startsWith("completion_request:"))
    );
  };

  /*
  Open the accept-request modal. The student picks whether to keep the
  listing open for other clients or to deactivate it before we actually
  process the accept.
  */
  const openAcceptModal = (req) => {
    setAcceptModal(req);
    setKeepListingActive(true);
  };

  /*
  handleAction accepts or declines a hire request.
  For "accepted", the optional `keepActive` arg controls whether we deactivate
  the listing after confirming the booking. The Accept button routes through
  the accept modal, which supplies this value; Decline skips the modal.
  */
  const handleAction = async (requestId, status, keepActive = true) => {
    setError("");
    setSuccess("");
    setActionLoading(requestId + status);
    try {
      //Update status of a booking. Doesn't appear to have an in app error handling
      const { error } = await updateBookingRequestStatus(requestId, status);
      if (error) throw error;
      const req = receivedRequests.find(r => r.request_id === requestId);

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
          const { data: booking, error: bookingError } = await createBooking({
            request_id: req.request_id,
            customer_id: req.customer_id,
            listing_id: req.listing_id,
            start_at: req.requested_start_at,
            end_at: req.requested_end_at,
            agreed_price_amount: agreedPrice,
          });
          if (bookingError) throw bookingError;

          const { error: paymentError } = await createPayment({
            booking_id: booking.bookings_id,
            customer_id: req.customer_id,
            student_id: req.listings?.student_id,
            amount: agreedPrice,
            status: "Unpaid",
          });
          if (paymentError) throw paymentError;

          // Student opted to deactivate the listing so no new hire
          // requests can come in. Keep this AFTER the booking is created
          // so a failure here doesn't block the accept.
          let deactivationSucceeded = keepActive; // true if we weren't trying to deactivate
          if (!keepActive && req.listing_id) {
            const { error: deactivateError } = await deactivateListing(req.listing_id);
            if (deactivateError) {
              console.error("Failed to deactivate listing:", deactivateError);
              deactivationSucceeded = false;
            } else {
              deactivationSucceeded = true;
            }
          }

          await createNotification({
            userId: req.customer_id,
            type: "booking_accepted:" + req.request_id,
          });

          if (keepActive) {
            setSuccess(`Request accepted. Your listing "${req.listings?.title}" will remain active.`);
          } else if (deactivationSucceeded) {
            setSuccess(`Request accepted. Your listing "${req.listings?.title}" has been deactivated.`);
          } else {
            // booking went through but the deactivation didn't — surface a warning instead of success
            setError(`Request accepted, but the listing "${req.listings?.title}" could not be deactivated. You can deactivate it manually from the Jobs page.`);
          }
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
      //alert("Action failed. Please try again.");
      setError("Action failed. Please try again.")
    } finally {
      setActionLoading(null);
    }
  };

  /*
  Called when the student confirms their choice in the accept modal.
  Routes through handleAction with the chosen `keepActive` flag.
  */
  const confirmAccept = async () => {
    if (!acceptModal) return;
    const req = acceptModal;
    setAcceptModal(null);
    await handleAction(req.request_id, "accepted", keepListingActive);
  };

  const getOtherPartyId = (booking) => {
    if (!booking || !dbUser) return null;
    if (booking.customer_id === dbUser.user_id) {
      return booking.listings?.student_id ?? booking.listings?.users?.user_id ?? null;
    }
    return booking.customer_id ?? null;
  };

  /*
  Returns the active completion_request notification for a given booking.
  Users will see a "Mark Job Complete" button on active bookings. If they click it, we create a 
  completion request notification for the other party. When they see that notification, 
  they can confirm the completion, which updates the booking status to completed.
  */
  const getPendingCompletionRequest = (bookingId) =>
    completionNotifications.find(n => n.type === `completion_request:${bookingId}`);

  const clearedKey = (typeKey, id) => `${typeKey}:${id}`;
  const isCleared = (typeKey, id) => clearedItems.has(clearedKey(typeKey, id));

  const persistClearedItems = (next) => {
    setClearedItems(next);
    if (!dbUser?.user_id) return;
    try {
      localStorage.setItem(
        `clearedPastItems_${dbUser.user_id}`,
        JSON.stringify([...next])
      );
    } catch {
      // Quota exceeded / storage disabled — state still updates in-memory.
    }
  };

  const clearPastItem = (typeKey, id) => {
    const next = new Set(clearedItems);
    next.add(clearedKey(typeKey, id));
    persistClearedItems(next);
  };

  const hasSentCompletionRequest = (bookingId) =>
    sentCompletionRequests.has(bookingId);

  const persistSentCompletionRequests = (next) => {
    setSentCompletionRequests(next);
    if (!dbUser?.user_id) return;
    try {
      localStorage.setItem(
        `sentCompletionRequests_${dbUser.user_id}`,
        JSON.stringify([...next])
      );
    } catch { /* storage disabled — in-memory only */ }
  };

  const markCompletionRequestSent = (bookingId) => {
    if (sentCompletionRequests.has(bookingId)) return;
    const next = new Set(sentCompletionRequests);
    next.add(bookingId);
    persistSentCompletionRequests(next);
  };

  const openCompleteModal = (booking, isConfirming) => {
    setCompleteModal({ booking, isConfirming });
  };

  //Either requests completion or confirms an existing completion request.
  const submitCompleteModal = async () => {
    if (!completeModal || !dbUser) return;
    const { booking, isConfirming } = completeModal;
    setError("");
    setSuccess("");
    setCompleting(true);
    try {
      const otherId = getOtherPartyId(booking);

      if (isConfirming) {
        // The other party already requested completion, finalise it.
        const { error: statusError } = await updateBookingStatus(booking.bookings_id, "completed");
        if (statusError) throw statusError;

        // Clear every completion request notification for a booking.
        const matching = completionNotifications.filter(
          n => n.type === `completion_request:${booking.bookings_id}`
        );
        await Promise.all(matching.map(n => markNotificationCleared(n.notification_id)));

        // Let the requester know the job is done.
        if (otherId) {
          await createNotification({
            userId: otherId,
            type: "booking_completed:" + booking.bookings_id,
            message: `"${booking.listings?.title}" has been marked as completed.`,
          });
        }

        setSuccess(`"${booking.listings?.title}" has been marked as completed.`);
      } else {
        // Requesting completion, notify the other party.
        if (!otherId) {
          throw new Error("Could not determine the other party for this booking.");
        }
        const { error: notifError } = await createNotification({
          userId: otherId,
          type: "completion_request:" + booking.bookings_id,
          message: `${dbUser.first_name} ${dbUser.last_name} marked "${booking.listings?.title}" as complete. Confirm once you're satisfied.`,
        });
        if (notifError) throw notifError;
        
        markCompletionRequestSent(booking.bookings_id);
        setSuccess("Completion request sent. Waiting for the other party to confirm.");
      }

      setCompleteModal(null);
      if (role === "student") await fetchStudentData(dbUser.user_id);
      else await fetchClientData(dbUser.user_id);
    } catch (err) {
      console.error("Complete action failed:", err);
      setError("Failed to update completion status. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  const openCancelModal = (booking) => {
    setCancelModal(booking);
    setCancelReason("");
  };

  const cancelBooking = async () => {
    setError("");
    setSuccess("");
    if (!cancelModal || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      //Cancel booking. No in app error handling
      const { error: cancelError } = await updateBookingStatus(cancelModal.bookings_id, "cancelled");
      if (cancelError) throw cancelError;

      const recipientId = cancelModal.customer_id === dbUser.user_id
        ? cancelModal.listings?.users?.user_id ?? null
        : cancelModal.customer_id;

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

        await createNotification({
          userId: recipientId,
          type: "booking_cancelled:" + cancelModal.bookings_id,
          message: `Your booking for "${cancelModal.listings?.title}" was cancelled by ${dbUser.first_name} ${dbUser.last_name}.`,
        });
      }

      setCancelModal(null);
      setCancelReason("");
      if (role === "student") await fetchStudentData(dbUser.user_id);
      else await fetchClientData(dbUser.user_id);
    } catch (err) {
      console.error("Cancel failed:", err);
      //alert("Failed to cancel booking. Please try again.");
      setError("Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const localStr = dateStr.slice(0, 10).replace(/-/g, "/");
    return new Date(localStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  };

  if (loading) return (
    <>
      <Navbar />
      <div className="container py-4">Loading...</div>
    </>
  );

  // Past items (completed bookings, cancelled bookings, cancelled requests).
  const byTimeDesc = (a, b) => {
    const ta = new Date(a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  };

  const pastCompletedBookings = (role === "student" ? studentBookings : clientBookings)
    .filter(b => b.status === "completed")
    .sort(byTimeDesc);
  const pastCancelledBookings = (role === "student" ? studentBookings : clientBookings)
    .filter(b => b.status === "cancelled")
    .sort(byTimeDesc);
  const dedupeRequests = (...lists) => {
    const byId = new Map();
    for (const list of lists) for (const r of list) byId.set(r.request_id, r);
    return [...byId.values()];
  };
  const allRequests = role === "student"
    ? dedupeRequests(sentRequests, receivedRequests)
    : clientSentRequests;
  const pastCancelledRequests = allRequests
    .filter(r => r.status === "cancelled")
    .sort(byTimeDesc);
  const pastDeclinedRequests = allRequests
    .filter(r => r.status === "declined")
    .sort(byTimeDesc);

  const clearedCount =
    pastCancelledBookings.filter(b => isCleared("booking", b.bookings_id)).length +
    pastCancelledRequests.filter(r => isCleared("request", r.request_id)).length + 
    pastDeclinedRequests.filter(r => isCleared("request", r.request_id)).length;
  const pastTotal =
    pastCompletedBookings.length + pastCancelledBookings.length + pastCancelledRequests.length +
    pastCancelledRequests.length + pastDeclinedRequests.length;
  const pastCount = pastTotal - clearedCount;

  const studentTabs = [
    { key: "sent",     label: "Sent Requests",     count: sentRequests.filter(r => r.status === "pending").length },
    { key: "received", label: "Received Requests",  count: receivedRequests.filter(r => r.status === "pending").length },
    { key: "active",   label: "Active Bookings",    count: studentBookings.filter(b => b.status === "confirmed").length },
    { key: "history",     label: "History",               count: pastCount },
  ];

  const clientTabs = [
    { key: "sent",   label: "Sent Requests",  count: clientSentRequests.filter(r => r.status === "pending").length },
    { key: "active", label: "Active Bookings", count: clientBookings.filter(b => b.status === "confirmed").length },
    { key: "history",   label: "History",           count: pastCount },
  ];

  const tabs = role === "student" ? studentTabs : clientTabs;

  return (
    <>
      <Navbar />
      <div className="container py-4">
        <h2 className="mb-4">Bookings</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          {tabs.map(tab => (
            <li className="nav-item" key={tab.key}>
              <button className={`nav-link ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>
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
            {(role === "student" ? sentRequests : clientSentRequests).filter(r => r.status === "pending").length === 0 ? (
              <p className="text-muted">No sent requests yet.</p>
            ) : (
              <div className="row g-3">
                {(role === "student" ? sentRequests : clientSentRequests).filter(r => r.status === "pending").map(req => (
                  <div className="col-md-6" key={req.request_id}>
                    <div className="card h-100 shadow-sm">
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <span className="fw-semibold">{req.listings?.title || "Listing"}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <div className="card-body">
                        <p className="text-muted small mb-1">
                          To: {req.listings?.users?.first_name} {req.listings?.users?.last_name}
                        </p>
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
                          Sent: {formatDate(req.created_at)}
                        </p>
                      </div>
                      {req.status === "pending" && (
                        <div className="card-footer">
                          <button className="btn btn-outline-danger btn-sm w-100" disabled={!!actionLoading} onClick={() => handleAction(req.request_id, "cancelled")}>
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
            {receivedRequests.filter(r => r.status === "pending").length === 0 ? (
              <p className="text-muted">No received requests yet.</p>
            ) : (
              <div className="row g-3">
                {receivedRequests.filter(r => r.status === "pending").map(req => (
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
                          <button className="btn btn-success btn-sm flex-fill" disabled={!!actionLoading} onClick={() => openAcceptModal(req)}>
                            {actionLoading === req.request_id + "accepted" ? "Accepting..." : "Accept"}
                          </button>
                          <button className="btn btn-outline-danger btn-sm flex-fill" disabled={!!actionLoading} onClick={() => handleAction(req.request_id, "declined")}>
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
            {(role === "student" ? studentBookings : clientBookings).filter(b => b.status === "confirmed").length === 0 ? (
              <p className="text-muted">No active bookings yet.</p>
            ) : (
              <div className="row g-3">
                {(role === "student" ? studentBookings : clientBookings)
                  .filter(b => b.status === "confirmed")
                  .map(booking => {
                    const pendingRequest = getPendingCompletionRequest(booking.bookings_id);
                    const requestAlreadySent = hasSentCompletionRequest(booking.bookings_id);
                    return (
                      <div className="col-md-6" key={booking.bookings_id}>
                        <div className="card h-100 shadow-sm">
                          <div className="card-header d-flex justify-content-between align-items-center">
                            <span className="fw-semibold">{booking.listings?.title || "Booking"}</span>
                            <StatusBadge status={booking.status} />
                          </div>
                          <div className="card-body">
                            {booking.customer_id === dbUser?.user_id ? (
                              <p className="text-muted small mb-1">
                                Student: {booking.listings?.users?.first_name} {booking.listings?.users?.last_name}
                              </p>
                            ) : (
                              <p className="text-muted small mb-1">
                                Client: {booking.users?.first_name} {booking.users?.last_name}
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
                            {pendingRequest && (
                              <p className="text-success small mb-0 mt-2">
                                The other party marked this job complete — confirm to finish.
                              </p>
                            )}
                          </div>
                          <div className="card-footer d-flex gap-2">
                            {pendingRequest ? (
                              <button className="btn btn-success btn-sm flex-fill" onClick={() => openCompleteModal(booking, true)}>
                                Confirm Completion
                              </button>
                            ) : requestAlreadySent ? (
                              <span className="text-success small flex-fill text-center fw-semibold">
                                Completion request sent
                              </span>
                            ) : (
                              <button className="btn btn-outline-success btn-sm flex-fill" onClick={() => openCompleteModal(booking, false)}>
                                Mark Job Complete
                              </button>
                            )}
                            <button className="btn btn-outline-danger btn-sm flex-fill" onClick={() => openCancelModal(booking)}>
                              Cancel Booking
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* History (completed bookings, cancelled bookings, cancelled requests) */}
        {activeTab === "history" && (
          <div>
            <h5 className="mb-3">History</h5>
            {(() => {
              // Cleared items are hidden permanently from the user's view.
              const visibleCompleted = pastCompletedBookings;
              const visibleCancelledB = pastCancelledBookings.filter(b => !isCleared("booking", b.bookings_id));
              const visibleCancelledR = pastCancelledRequests.filter(r => !isCleared("request", r.request_id));
              const visibleDeclinedR = pastDeclinedRequests.filter(r => !isCleared("request", r.request_id));
              const visibleCount = visibleCompleted.length + visibleCancelledB.length + visibleCancelledR.length + visibleDeclinedR.length;

              if (visibleCount === 0) {
                return <p className="text-muted">Nothing here yet.</p>;
              }

              return (
                <>
                  {visibleCompleted.length > 0 && (
                    <>
                      <h6 className="text-muted text medium mb-2">Completed Bookings</h6>
                      <div className="row g-3 mb-4">
                        {visibleCompleted.map(booking => (
                          <div className="col-md-6" key={`cb-${booking.bookings_id}`}>
                            <div className="card h-100 shadow-sm">
                              <div className="card-header d-flex justify-content-between align-items-center">
                                <span className="fw-semibold">{booking.listings?.title || "Booking"}</span>
                                <StatusBadge status={booking.status} />
                              </div>
                              <div className="card-body">
                                {booking.customer_id === dbUser?.user_id ? (
                                  <p className="text-muted small mb-1">
                                    Student: {booking.listings?.users?.first_name} {booking.listings?.users?.last_name}
                                  </p>
                                ) : (
                                  <p className="text-muted small mb-1">
                                    Client: {booking.users?.first_name} {booking.users?.last_name}
                                  </p>
                                )}
                                <p className="text-muted small mb-1">
                                  Agreed Price: ${booking.agreed_price_amount}
                                </p>
                                <p className="text-muted small mb-1">
                                  Start: {formatDate(booking.start_at)} &rarr; {formatDate(booking.end_at)}
                                </p>
                                {booking.updated_at && (
                                  <p className="text-muted small mb-0">
                                    Completed: {formatDate(booking.updated_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {visibleCancelledB.length > 0 && (
                    <>
                      <h6 className="text-muted text medium mb-2">Cancelled Bookings</h6>
                      <div className="row g-3 mb-4">
                        {visibleCancelledB.map(booking => (
                          <div className="col-md-6" key={`xb-${booking.bookings_id}`}>
                            <div className="card h-100 shadow-sm">
                              <div className="card-header d-flex justify-content-between align-items-center">
                                <span className="fw-semibold">{booking.listings?.title || "Booking"}</span>
                                <div className="d-flex align-items-center gap-2">
                                  <StatusBadge status={booking.status} />
                                  <button
                                    type="button"
                                    className="btn-close"
                                    style={{ fontSize: "0.65rem" }}
                                    aria-label="Clear"
                                    title="Clear from History"
                                    onClick={() => clearPastItem("booking", booking.bookings_id)}
                                  />
                                </div>
                              </div>
                              <div className="card-body">
                                {booking.customer_id === dbUser?.user_id ? (
                                  <p className="text-muted small mb-1">
                                    Student: {booking.listings?.users?.first_name} {booking.listings?.users?.last_name}
                                  </p>
                                ) : (
                                  <p className="text-muted small mb-1">
                                    Client: {booking.users?.first_name} {booking.users?.last_name}
                                  </p>
                                )}
                                <p className="text-muted small mb-1">
                                  Agreed Price: ${booking.agreed_price_amount}
                                </p>
                                <p className="text-muted small mb-1">
                                  Start: {formatDate(booking.start_at)} &rarr; {formatDate(booking.end_at)}
                                </p>
                                {booking.updated_at && (
                                  <p className="text-muted small mb-0">
                                    Cancelled: {formatDate(booking.updated_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {visibleCancelledR.length > 0 && (
                    <>
                      <h6 className="text-muted text medium mb-2">Cancelled Requests</h6>
                      <div className="row g-3 mb-4">
                        {visibleCancelledR.map(req => (
                          <div className="col-md-6" key={`xr-${req.request_id}`}>
                            <div className="card h-100 shadow-sm">
                              <div className="card-header d-flex justify-content-between align-items-center">
                                <span className="fw-semibold">{req.listings?.title || "Listing"}</span>
                                <div className="d-flex align-items-center gap-2">
                                  <StatusBadge status={req.status} />
                                  <button
                                    type="button"
                                    className="btn-close"
                                    style={{ fontSize: "0.65rem" }}
                                    aria-label="Clear"
                                    title="Clear from History"
                                    onClick={() => clearPastItem("request", req.request_id)}
                                  />
                                </div>
                              </div>
                              <div className="card-body">
                                {req.customer_id === dbUser?.user_id ? (
                                  <p className="text-muted small mb-1">
                                    To: {req.listings?.users?.first_name} {req.listings?.users?.last_name}
                                  </p>
                                ) : (
                                  <p className="text-muted small mb-1">
                                    From: {req.users?.first_name} {req.users?.last_name}
                                  </p>
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
                                {req.updated_at && (
                                  <p className="text-muted small mb-0">
                                    Cancelled: {formatDate(req.updated_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {visibleDeclinedR.length > 0 && (
                    <>
                      <h6 className="text-muted text medium mb-2">Declined Requests</h6>
                      <div className="row g-3 mb-4">
                        {visibleDeclinedR.map(req => (
                          <div className="col-md-6" key={`dr-${req.request_id}`}>
                            <div className="card h-100 shadow-sm">
                              <div className="card-header d-flex justify-content-between align-items-center">
                                <span className="fw-semibold">{req.listings?.title || "Listing"}</span>
                                <div className="d-flex align-items-center gap-2">
                                  <StatusBadge status={req.status} />
                                  <button
                                    type="button"
                                    className="btn-close"
                                    style={{ fontSize: "0.65rem" }}
                                    aria-label="Clear"
                                    title="Clear from History"
                                    onClick={() => clearPastItem("request", req.request_id)}
                                  />
                                </div>
                              </div>
                              <div className="card-body">
                                {req.customer_id === dbUser?.user_id ? (
                                  <p className="text-muted small mb-1">
                                    To: {req.listings?.users?.first_name} {req.listings?.users?.last_name}
                                  </p>
                                ) : (
                                  <p className="text-muted small mb-1">
                                    From: {req.users?.first_name} {req.users?.last_name}
                                  </p>
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
                                {req.updated_at && (
                                  <p className="text-muted small mb-0">
                                    Declined: {formatDate(req.updated_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Accept Hire Request Modal */}
        {acceptModal && (
          <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-sm modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Accept Request</h5>
                  <button type="button" className="btn-close" onClick={() => setAcceptModal(null)} />
                </div>
                <div className="modal-body">
                  <p className="text-muted small mb-3">
                    Accepting: <strong>{acceptModal.listings?.title}</strong>
                  </p>
                  <div className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="acceptListingChoice"
                      id="keepListingActive"
                      checked={keepListingActive}
                      onChange={() => setKeepListingActive(true)}
                    />
                    <label className="form-check-label" htmlFor="keepListingActive">
                      Accept and keep listing active
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="acceptListingChoice"
                      id="deactivateListing"
                      checked={!keepListingActive}
                      onChange={() => setKeepListingActive(false)}
                    />
                    <label className="form-check-label" htmlFor="deactivateListing">
                      Accept and deactivate listing
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setAcceptModal(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-success" disabled={!!actionLoading} onClick={confirmAccept}>
                    {actionLoading ? "Accepting..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete Job Modal (for both requesting and confirming) */}
        {completeModal && (
          <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-sm modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {completeModal.isConfirming ? "Confirm Completion" : "Mark Job Complete"}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setCompleteModal(null)} />
                </div>
                <div className="modal-body">
                  <p className="text-muted small mb-2">
                    Booking: <strong>{completeModal.booking.listings?.title}</strong>
                  </p>
                  {completeModal.isConfirming ? (
                    <p className="mb-0 small">
                      The other party has marked this job as complete. Confirming will close the booking and move it to History.
                    </p>
                  ) : (
                    <p className="mb-0 small">
                      The other party will be notified. Once they confirm, the booking will move to History.
                    </p>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setCompleteModal(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-success" disabled={completing} onClick={submitCompleteModal} >
                    {completing
                      ? (completeModal.isConfirming ? "Confirming..." : "Sending...")
                      : (completeModal.isConfirming ? "Confirm" : "Mark Complete")}
                  </button>
                </div>
              </div>
            </div>
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
                    onChange={e => setCancelReason(e.target.value)}
                  />
                  <p className="text-muted small mt-2 mb-0">
                    This message will be sent automatically to the other party.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setCancelModal(null)}>
                    Keep Booking
                  </button>
                  <button className="btn btn-danger" disabled={!cancelReason.trim() || cancelling} onClick={cancelBooking}>
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