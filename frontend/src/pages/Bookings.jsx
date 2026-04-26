import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  createListingReport,
  createUserReport,
  getReviewByReviewerAndStudent,
} from "../services/supabaseapi";

/*
Component to handle bookings.
Handles booking requests, active bookings, cancellations, reports,
and review entry after a booking has been accepted.
*/

const STATUS_BADGE = {
  pending: "bg-warning text-dark",
  accepted: "bg-success",
  declined: "bg-danger",
  cancelled: "bg-secondary",
  confirmed: "bg-success",
  completed: "bg-primary",
  expired: "bg-secondary",
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [dbUser, setDbUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [studentBookings, setStudentBookings] = useState([]);

  const [clientSentRequests, setClientSentRequests] = useState([]);
  const [clientBookings, setClientBookings] = useState([]);

  const [reviewStatusByBooking, setReviewStatusByBooking] = useState({});

  const [activeTab, setActiveTab] = useState("sent");
  const [actionLoading, setActionLoading] = useState(null);

  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [acceptModal, setAcceptModal] = useState(null);
  const [keepListingActive, setKeepListingActive] = useState(true);

  const [reportModal, setReportModal] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user?.email) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!loading && dbUser && role) {
      const bookingId = searchParams.get("bookingId");
      const tab = searchParams.get("tab");

      if (bookingId) {
        const targetId = parseInt(bookingId, 10);

        if (role === "student") {
          const sentReq = sentRequests.find((r) => r.request_id === targetId);
          if (sentReq) {
            setActiveTab("sent");
            return;
          }

          const receivedReq = receivedRequests.find((r) => r.request_id === targetId);
          if (receivedReq) {
            setActiveTab("received");
            return;
          }

          const booking = studentBookings.find((b) => b.bookings_id === targetId);
          if (booking) {
            setActiveTab("active");
            return;
          }
        } else {
          const sentReq = clientSentRequests.find((r) => r.request_id === targetId);
          if (sentReq) {
            setActiveTab("sent");
            return;
          }

          const booking = clientBookings.find((b) => b.bookings_id === targetId);
          if (booking) {
            setActiveTab("active");
            return;
          }
        }
      } else if (tab) {
        if (role === "student" && ["sent", "received", "active"].includes(tab)) {
          setActiveTab(tab);
        } else if (role === "client" && ["sent", "active"].includes(tab)) {
          setActiveTab(tab);
        }
      }
    }
  }, [
    searchParams,
    loading,
    dbUser,
    role,
    sentRequests,
    receivedRequests,
    studentBookings,
    clientSentRequests,
    clientBookings,
  ]);

  useEffect(() => {
    if (role === "client" && dbUser?.user_id && clientBookings.length > 0) {
      fetchReviewStatuses(clientBookings, dbUser.user_id);
    } else {
      setReviewStatusByBooking({});
    }
  }, [role, dbUser, clientBookings]);

  const fetchReviewStatuses = async (bookings, currentUserId) => {
    try {
      const relevantBookings = bookings.filter((booking) => {
        const studentId = booking.listings?.users?.user_id;
        return (
          booking.customer_id === currentUserId &&
          studentId &&
          (booking.status === "confirmed" || booking.status === "completed")
        );
      });

      const entries = await Promise.all(
        relevantBookings.map(async (booking) => {
          const studentId = booking.listings?.users?.user_id;

          const { data } = await getReviewByReviewerAndStudent(currentUserId, studentId);

          return [
            booking.bookings_id,
            {
              canReview: true,
              hasReview: !!data,
              reviewId: data?.review_id || null,
              studentId,
            },
          ];
        })
      );

      setReviewStatusByBooking(Object.fromEntries(entries));
    } catch (err) {
      console.error("Failed to load review status:", err);
    }
  };

  const openReportModal = ({ type, target, listingId = null, listingOwnerId = null }) => {
    setReportModal({ type, target, listingId, listingOwnerId });
    setReportReason("");
    setReportDetails("");
  };

  const closeReportModal = () => {
    setReportModal(null);
    setReportReason("");
    setReportDetails("");
  };

  const submitReport = async () => {
    if (!reportReason || !dbUser || !reportModal) return;

    setReporting(true);
    setError("");
    setSuccess("");

    try {
      if (reportModal.type === "listing") {
        const { error } = await createListingReport({
          listingId: reportModal.listingId,
          reportedByUserId: dbUser.user_id,
          listingOwnerUserId: reportModal.listingOwnerId,
          reason: reportReason,
          details: reportDetails.trim() || null,
        });
        if (error) throw error;
      } else {
        const { error } = await createUserReport({
          reportedUserId: reportModal.target.user_id,
          reportedByUserId: dbUser.user_id,
          reason: reportReason,
          details: reportDetails.trim() || null,
        });
        if (error) throw error;
      }

      closeReportModal();
      setSuccess("Report submitted. Our team will review it shortly.");
    } catch (err) {
      console.error("Failed to submit report:", err);
      setError("Failed to submit report. Please try again.");
    } finally {
      setReporting(false);
    }
  };

  const fetchData = async () => {
    try {
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
      setError("Failed to fetch booking data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentData = async (userId) => {
    const [sentRes, receivedRes, providerBookingsRes, customerBookingsRes] =
      await Promise.all([
        getBookingRequestsByClient(userId),
        getBookingRequestsForStudent(userId),
        getBookingsForStudent(userId),
        getBookingsByClient(userId),
      ]);

    setSentRequests(sentRes.data || []);
    setReceivedRequests(receivedRes.data || []);
    setStudentBookings([
      ...(providerBookingsRes.data || []),
      ...(customerBookingsRes.data || []),
    ]);
  };

  const fetchClientData = async (userId) => {
    const [sentRes, bookingsRes] = await Promise.all([
      getBookingRequestsByClient(userId),
      getBookingsByClient(userId),
    ]);

    setClientSentRequests(sentRes.data || []);
    setClientBookings(bookingsRes.data || []);
  };

  const openAcceptModal = (req) => {
    setAcceptModal(req);
    setKeepListingActive(true);
  };

  const handleAction = async (requestId, status, keepActive = true) => {
    setError("");
    setSuccess("");
    setActionLoading(requestId + status);

    try {
      const { error } = await updateBookingRequestStatus(requestId, status);
      if (error) throw error;

      const req = receivedRequests.find((r) => r.request_id === requestId);

      if (status === "accepted" && req) {
        let agreedPrice = req.listings?.price_amount ?? 0;

        try {
          const parsed = JSON.parse(req.note || "{}");
          if (parsed.agreed_price != null) agreedPrice = parsed.agreed_price;
        } catch {
          // use listing price
        }

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

        let deactivationSucceeded = keepActive;

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
          message: `Your booking request for "${req.listings?.title}" has been accepted.`,
        });

        if (keepActive) {
          setSuccess(
            `Request accepted. Your listing "${req.listings?.title}" will remain active.`
          );
        } else if (deactivationSucceeded) {
          setSuccess(
            `Request accepted. Your listing "${req.listings?.title}" has been deactivated.`
          );
        } else {
          setError(
            `Request accepted, but the listing "${req.listings?.title}" could not be deactivated. You can deactivate it manually from the Jobs page.`
          );
        }
      }

      if (status === "declined" && req) {
        await createNotification({
          userId: req.customer_id,
          type: "booking_declined:" + req.request_id,
          message: `Your booking request for "${req.listings?.title}" has been declined.`,
        });
      }

      if (status === "cancelled" && req) {
        setSuccess("Request cancelled.");
      }

      if (role === "student") {
        await fetchStudentData(dbUser.user_id);
      } else {
        await fetchClientData(dbUser.user_id);
      }
    } catch (err) {
      console.error("Action failed:", err);
      setError("Action failed. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmAccept = async () => {
    if (!acceptModal) return;
    const req = acceptModal;
    setAcceptModal(null);
    await handleAction(req.request_id, "accepted", keepListingActive);
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
      const { error: cancelError } = await updateBookingStatus(
        cancelModal.bookings_id,
        "cancelled"
      );
      if (cancelError) throw cancelError;

      const recipientId =
        cancelModal.customer_id === dbUser.user_id
          ? cancelModal.listings?.users?.user_id ?? null
          : cancelModal.customer_id;

      if (recipientId) {
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
      setSuccess("Booking cancelled.");

      if (role === "student") {
        await fetchStudentData(dbUser.user_id);
      } else {
        await fetchClientData(dbUser.user_id);
      }
    } catch (err) {
      console.error("Cancel failed:", err);
      setError("Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleReviewClick = (booking) => {
    const studentId = booking.listings?.users?.user_id;
    if (!studentId) {
      setError("Could not find the student for this booking.");
      return;
    }

    navigate(`/reviews?studentId=${studentId}&bookingId=${booking.bookings_id}`);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const localStr = dateStr.slice(0, 10).replace(/-/g, "/");
    return new Date(localStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container py-4">Loading...</div>
      </>
    );
  }

  const studentTabs = [
    {
      key: "sent",
      label: "Sent Requests",
      count: sentRequests.filter(
        (r) => r.status !== "cancelled" && r.status !== "accepted"
      ).length,
    },
    {
      key: "received",
      label: "Received Requests",
      count: receivedRequests.filter((r) => r.status === "pending").length,
    },
    {
      key: "active",
      label: "Active Bookings",
      count: studentBookings.filter(
        (b) => b.status === "confirmed" || b.status === "completed"
      ).length,
    },
  ];

  const clientTabs = [
    {
      key: "sent",
      label: "Sent Requests",
      count: clientSentRequests.filter(
        (r) => r.status !== "cancelled" && r.status !== "accepted"
      ).length,
    },
    {
      key: "active",
      label: "Active Bookings",
      count: clientBookings.filter(
        (b) => b.status === "confirmed" || b.status === "completed"
      ).length,
    },
  ];

  const tabs = role === "student" ? studentTabs : clientTabs;

  const sentList = role === "student" ? sentRequests : clientSentRequests;
  const activeBookingsList = role === "student" ? studentBookings : clientBookings;

  return (
    <>
      <Navbar />

      <div className="container py-4">
        <h2 className="mb-4">Bookings</h2>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

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

        {activeTab === "sent" && (
          <div>
            <h5 className="mb-3">
              {role === "student"
                ? "Hire requests you've sent"
                : "Booking requests you've sent"}
            </h5>

            {sentList.filter(
              (r) => r.status !== "cancelled" && r.status !== "accepted"
            ).length === 0 ? (
              <p className="text-muted">No sent requests yet.</p>
            ) : (
              <div className="row g-3">
                {sentList
                  .filter((r) => r.status !== "cancelled" && r.status !== "accepted")
                  .map((req) => (
                    <div className="col-md-6" key={req.request_id}>
                      <div className="card h-100 shadow-sm">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">
                            {req.listings?.title || "Listing"}
                          </span>
                          <StatusBadge status={req.status} />
                        </div>

                        <div className="card-body">
                          <p className="text-muted small mb-1">
                            To: {req.listings?.users?.first_name}{" "}
                            {req.listings?.users?.last_name}
                          </p>

                          {(() => {
                            try {
                              const parsed = JSON.parse(req.note || "{}");
                              if (parsed.agreed_price != null) {
                                return (
                                  <p className="text-muted small mb-1">
                                    Proposed Price: <strong>${parsed.agreed_price}</strong>
                                  </p>
                                );
                              }
                            } catch {}
                            return null;
                          })()}

                          <p className="text-muted small mb-1">
                            Start: {formatDate(req.requested_start_at)} &rarr;{" "}
                            {formatDate(req.requested_end_at)}
                          </p>

                          <p className="text-muted small mb-0">
                            Sent: {formatDate(req.created_at)}
                          </p>
                        </div>

                        {req.status === "pending" && (
                          <div className="card-footer">
                            <button
                              className="btn btn-outline-danger btn-sm w-100"
                              disabled={!!actionLoading}
                              onClick={() => handleAction(req.request_id, "cancelled")}
                            >
                              {actionLoading === req.request_id + "cancelled"
                                ? "Cancelling..."
                                : "Cancel Request"}
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

        {activeTab === "received" && role === "student" && (
          <div>
            <h5 className="mb-3">Hire requests sent to you</h5>

            {receivedRequests.filter(
              (r) => r.status !== "cancelled" && r.status !== "accepted"
            ).length === 0 ? (
              <p className="text-muted">No received requests yet.</p>
            ) : (
              <div className="row g-3">
                {receivedRequests
                  .filter((r) => r.status !== "cancelled" && r.status !== "accepted")
                  .map((req) => (
                    <div className="col-md-6" key={req.request_id}>
                      <div className="card h-100 shadow-sm">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">
                            {req.listings?.title || "Listing"}
                          </span>
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
                              if (parsed.agreed_price != null) {
                                return (
                                  <p className="text-muted small mb-1">
                                    Proposed Price: <strong>${parsed.agreed_price}</strong>
                                  </p>
                                );
                              }
                            } catch {}
                            return null;
                          })()}

                          <p className="text-muted small mb-1">
                            Start: {formatDate(req.requested_start_at)} &rarr;{" "}
                            {formatDate(req.requested_end_at)}
                          </p>

                          <p className="text-muted small mb-0">
                            Received: {formatDate(req.created_at)}
                          </p>
                        </div>

                        {req.status === "pending" && (
                          <div className="card-footer d-flex gap-2 flex-wrap">
                            <button
                              className="btn btn-success btn-sm flex-fill"
                              disabled={!!actionLoading}
                              onClick={() => openAcceptModal(req)}
                            >
                              {actionLoading === req.request_id + "accepted"
                                ? "Accepting..."
                                : "Accept"}
                            </button>

                            <button
                              className="btn btn-outline-danger btn-sm flex-fill"
                              disabled={!!actionLoading}
                              onClick={() => handleAction(req.request_id, "declined")}
                            >
                              {actionLoading === req.request_id + "declined"
                                ? "Declining..."
                                : "Decline"}
                            </button>

                            {req.users?.user_id && (
                              <button
                                className="btn btn-outline-warning btn-sm"
                                title="Report this client"
                                onClick={() =>
                                  openReportModal({ type: "user", target: req.users })
                                }
                              >
                                ⚑ Report
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "active" && (
          <div>
            <h5 className="mb-3">Active bookings</h5>

            {activeBookingsList.filter(
              (b) => b.status === "confirmed" || b.status === "completed"
            ).length === 0 ? (
              <p className="text-muted">No active bookings yet.</p>
            ) : (
              <div className="row g-3">
                {activeBookingsList
                  .filter((b) => b.status === "confirmed" || b.status === "completed")
                  .map((booking) => {
                    const reviewInfo = reviewStatusByBooking[booking.bookings_id];
                    const showReviewButton =
                      role === "client" &&
                      booking.customer_id === dbUser?.user_id &&
                      reviewInfo?.canReview;

                    return (
                      <div className="col-md-6" key={booking.bookings_id}>
                        <div className="card h-100 shadow-sm">
                          <div className="card-header d-flex justify-content-between align-items-center">
                            <span className="fw-semibold">
                              {booking.listings?.title || "Booking"}
                            </span>
                            <StatusBadge status={booking.status} />
                          </div>

                          <div className="card-body">
                            {booking.customer_id === dbUser?.user_id ? (
                              <p className="text-muted small mb-1">
                                Student: {booking.listings?.users?.first_name}{" "}
                                {booking.listings?.users?.last_name}
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
                          </div>

                          <div className="card-footer d-flex gap-2 flex-wrap">
                            <button
                              className="btn btn-outline-danger btn-sm flex-fill"
                              onClick={() => openCancelModal(booking)}
                            >
                              Cancel Booking
                            </button>

                            {showReviewButton && (
                              <button
                                className="btn btn-outline-primary btn-sm flex-fill"
                                onClick={() => handleReviewClick(booking)}
                              >
                                {reviewInfo?.hasReview ? "Edit Review" : "Leave Review"}
                              </button>
                            )}

                            {role === "client" && booking.listings?.users && (
                              <button
                                className="btn btn-outline-warning btn-sm"
                                title="Report this student"
                                onClick={() =>
                                  openReportModal({
                                    type: "user",
                                    target: booking.listings.users,
                                  })
                                }
                              >
                                ⚑ Report
                              </button>
                            )}

                            {role === "student" &&
                              booking.customer_id !== dbUser?.user_id &&
                              booking.users && (
                                <button
                                  className="btn btn-outline-warning btn-sm"
                                  title="Report this client"
                                  onClick={() =>
                                    openReportModal({
                                      type: "user",
                                      target: booking.users,
                                    })
                                  }
                                >
                                  ⚑ Report
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {acceptModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-sm modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Accept Request</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setAcceptModal(null)}
                  />
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
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setAcceptModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-success"
                    disabled={!!actionLoading}
                    onClick={confirmAccept}
                  >
                    {actionLoading ? "Accepting..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {cancelModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Cancel Booking</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setCancelModal(null)}
                  />
                </div>

                <div className="modal-body">
                  <p className="text-muted small mb-3">
                    Cancelling: <strong>{cancelModal.listings?.title}</strong>
                  </p>

                  <label className="form-label">
                    Reason for cancellation <span className="text-danger">*</span>
                  </label>

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
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setCancelModal(null)}
                  >
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

        {reportModal && (
          <div
            className="modal d-block"
            tabIndex="-1"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 rounded-4">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title text-danger">
                    {reportModal.type === "listing" ? "Report Listing" : "Report User"}
                  </h5>
                  <button type="button" className="btn-close" onClick={closeReportModal} />
                </div>

                <div className="modal-body pt-2">
                  <p className="text-muted small mb-3">
                    {reportModal.type === "listing" ? (
                      <>
                        Reporting listing: <strong>{reportModal.target?.title}</strong>
                      </>
                    ) : (
                      <>
                        Reporting user:{" "}
                        <strong>
                          {reportModal.target?.first_name} {reportModal.target?.last_name}
                        </strong>
                      </>
                    )}
                  </p>

                  <div className="mb-3">
                    <label className="form-label fw-medium">
                      Reason <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                    >
                      <option value="">Select a reason</option>
                      <option value="scam_or_fraud">Scam or fraud</option>
                      <option value="fake_profile">Fake profile</option>
                      <option value="misleading_listing">Misleading listing</option>
                      <option value="spam">Spam</option>
                      <option value="harassment">Harassment</option>
                      <option value="inappropriate_content">Inappropriate content</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="mb-0">
                    <label className="form-label fw-medium">
                      Details <span className="text-muted">(optional)</span>
                    </label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="Provide any additional context to help our review team…"
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-0 pt-0">
                  <button
                    className="btn btn-light"
                    onClick={closeReportModal}
                    disabled={reporting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={submitReport}
                    disabled={!reportReason || reporting}
                  >
                    {reporting ? "Submitting…" : "Submit Report"}
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