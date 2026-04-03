import { useState, useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../supabaseconfig";
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  getUserByEmail,
} from "../services/supabaseapi";

const TYPE_ICONS = {
  message: "💬",
  booking_request: "📋",
  booking_update: "📅",
  booking_accepted: "✅",
  booking_declined: "❌",
  booking_cancelled: "🚫",
};

const TYPE_LABELS = {
  message: "New Message",
  booking_request: "Booking Request",
  booking_update: "Booking Update",
  booking_accepted: "Booking Accepted",
  booking_declined: "Booking Declined",
  booking_cancelled: "Booking Cancelled",
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth0();
  const [dbUserId, setDbUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // Load user ID
  useEffect(() => {
    if (!user?.email) return;
    getUserByEmail(user.email).then(({ data }) => {
      if (data?.user_id) setDbUserId(data.user_id);
    });
  }, [user]);

  // Fetch notifications
  useEffect(() => {
    if (!dbUserId) return;
    let isMounted = true;
    const fetchData = async () => {
      const { data } = await getNotificationsForUser(dbUserId);
      if (isMounted) setNotifications(data || []);
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [dbUserId]);

  // Real-time subscription
  useEffect(() => {
    if (!dbUserId) return;

    const channel = supabase
      .channel(`notifications-user-${dbUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${dbUserId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [dbUserId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (notificationId) => {
    await markNotificationRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.notification_id === notificationId ? { ...n, status: "read" } : n
      )
    );
  };

  const handleMarkAllRead = async () => {
    if (!dbUserId) return;
    await markAllNotificationsRead(dbUserId);
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
  };

  const toggleDropdown = () => setOpen((v) => !v);

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={toggleDropdown}
        aria-label="Notifications"
        style={{
          position: "relative",
          background: "none",
          border: "none",
          padding: "6px 8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          transition: "background 0.15s ease",
          color: "#374151",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        {/* Bell SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Red badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              background: "#ef4444",
              color: "#fff",
              borderRadius: "9999px",
              fontSize: "10px",
              fontWeight: 700,
              minWidth: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              lineHeight: 1,
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
            width: "360px",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e5e7eb",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px 10px",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, fontSize: "15px", color: "#111827" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "1px 7px",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#6366f1",
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: "6px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: "420px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "14px",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔔</div>
                <div style={{ fontWeight: 500 }}>No notifications yet</div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  You'll be notified about messages and booking updates
                </div>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => n.status === "unread" && handleMarkRead(n.notification_id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px 16px",
                    borderBottom: "1px solid #f9fafb",
                    background: n.status === "unread" ? "#fafafa" : "#fff",
                    cursor: n.status === "unread" ? "pointer" : "default",
                    transition: "background 0.1s",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (n.status === "unread")
                      e.currentTarget.style.background = "#f3f4f6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      n.status === "unread" ? "#fafafa" : "#fff";
                  }}
                >
                  {/* Unread dot */}
                  {n.status === "unread" && (
                    <span
                      style={{
                        position: "absolute",
                        left: "6px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#6366f1",
                        flexShrink: 0,
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_ICONS[n.type] || "🔔"}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: n.status === "unread" ? 600 : 500,
                        fontSize: "13px",
                        color: "#111827",
                        marginBottom: "2px",
                      }}
                    >
                      {TYPE_LABELS[n.type] || "Notification"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {n.message || n.type}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        marginTop: "4px",
                      }}
                    >
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid #f3f4f6",
                textAlign: "center",
              }}
            >
              <button
                onClick={async () => {
                  setOpen(false);
                  if (!dbUserId) return;
                  const { data } = await getNotificationsForUser(dbUserId);
                  setNotifications(data || []);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#6b7280",
                  fontWeight: 500,
                }}
              >
                Refresh ↺
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}