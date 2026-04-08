import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getNotificationsForUser, markNotificationCleared } from "../services/supabaseapi";

const TYPE_LABELS = {
  message:         "New message",
  booking_request: "Booking request",
  booking_accepted:"Booking accepted",
  booking_declined:"Booking declined",
  booking_cancelled:"Booking cancelled",
  review:          "New review",
  payment:         "Payment update",
};

const TYPE_ICONS = {
  message:          "💬",
  booking_request:  "📋",
  booking_accepted: "✅",
  booking_declined: "❌",
  booking_cancelled:"🚫",
  review:           "⭐",
  payment:          "💳",
};

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Load notifications whenever userId changes
  useEffect(() => {
    if (!userId) return;
    fetchNotifications();
  }, [userId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchNotifications = async () => {
    const { data, error } = await getNotificationsForUser(userId);
    if (!error && data) setNotifications(data);
  };

  const handleClear = async (e, notificationId) => {
    e.stopPropagation(); // don't trigger the row click / navigate
    const { error } = await markNotificationCleared(notificationId);
    if (!error) {
      setNotifications((prev) =>
        prev.filter((n) => n.notification_id !== notificationId)
      );
    }
  };

  const handleClearAll = async () => {
    await Promise.all(
      notifications.map((n) => markNotificationCleared(n.notification_id))
    );
    setNotifications([]);
  };

  const handleNotificationClick = (notification) => {
    setOpen(false);
    // channel stores the destination route, e.g. "/messages" or "/bookings"
    const route = notification.channel;
    if (route && route.startsWith("/")) {
      navigate(route);
    }
  };

  const unreadCount = notifications.length;

  return (
    <div
      className="position-relative"
      ref={dropdownRef}
      style={{ display: "inline-block" }}
    >
      {/* Bell button */}
      <button
        className="btn btn-light position-relative p-2"
        style={{
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          lineHeight: 1,
        }}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        title="Notifications"
      >
        {/* Bell icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          viewBox="0 0 16 16"
          style={{ display: "block" }}
        >
          <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.921L8 1.918zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z" />
        </svg>

        {/* Red badge — only shown when there are notifications */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              bottom: "2px",
              right: "2px",
              backgroundColor: "#dc3545",
              color: "#fff",
              borderRadius: "50%",
              fontSize: "10px",
              fontWeight: 700,
              minWidth: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              padding: "0 3px",
              pointerEvents: "none",
              boxShadow: "0 0 0 2px #fff",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "320px",
            backgroundColor: "#fff",
            border: "1px solid #dee2e6",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 1050,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#fafafa",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "14px" }}>
              Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </span>
            {unreadCount > 0 && (
              <button
                className="btn btn-link btn-sm p-0"
                style={{ fontSize: "12px", color: "#6c757d", textDecoration: "none" }}
                onClick={handleClearAll}
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: "380px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "#adb5bd",
                  fontSize: "13px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔔</div>
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px 16px",
                    borderBottom: "1px solid #f5f5f5",
                    cursor: n.channel?.startsWith("/") ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (n.channel?.startsWith("/"))
                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {/* Icon */}
                  <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>
                    {TYPE_ICONS[n.type] ?? "🔔"}
                  </span>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#212529",
                        marginBottom: "2px",
                      }}
                    >
                      {TYPE_LABELS[n.type] ?? n.type}
                    </div>
                    {n.message && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6c757d",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {n.message}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: "#adb5bd", marginTop: "3px" }}>
                      {new Date(n.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {/* Clear button */}
                  <button
                    className="btn btn-link p-0"
                    style={{
                      fontSize: "16px",
                      color: "#adb5bd",
                      lineHeight: 1,
                      flexShrink: 0,
                      textDecoration: "none",
                    }}
                    onClick={(e) => handleClear(e, n.notification_id)}
                    title="Dismiss"
                    aria-label="Dismiss notification"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}