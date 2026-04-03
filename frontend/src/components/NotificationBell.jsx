import { useState, useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../supabaseconfig";
import {
  getUserByEmail,
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/supabaseapi";

// Human-readable labels for each notification type
const TYPE_LABELS = {
  message:           "New Message",
  booking_request:   "Booking Request",
  booking_accepted:  "Booking Accepted",
  booking_declined:  "Booking Declined",
  booking_cancelled: "Booking Cancelled",
  booking_update:    "Booking Update",
};

// Short description shown below the label
const TYPE_DESCRIPTION = {
  message:           "Someone sent you a message",
  booking_request:   "You received a new hire request",
  booking_accepted:  "Your booking request was accepted",
  booking_declined:  "Your booking request was declined",
  booking_cancelled: "A booking was cancelled",
  booking_update:    "There was an update to a booking",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth0();

  const [dbUserId, setDbUserId]    = useState(null);
  const [notifications, setNotifs] = useState([]);
  const [loading, setLoading]      = useState(true);
  const [open, setOpen]            = useState(false);

  const dropdownRef = useRef(null);
  const channelRef  = useRef(null);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // ── 1. Resolve DB user_id ────────────────────────
  useEffect(() => {
    if (!user?.email) return;
    getUserByEmail(user.email).then(({ data }) => {
      if (data?.user_id) setDbUserId(data.user_id);
    });
  }, [user]);

  // ── 2. Fetch notifications ────────────────────────
  useEffect(() => {
  if (!dbUserId) return;

  let isMounted = true;

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await getNotificationsForUser(dbUserId);
    if (!isMounted) return;
    if (error) {
      console.warn("[NotificationBell] fetch error:", error.message);
      setNotifs([]);
    } else {
      setNotifs(data || []);
    }
    setLoading(false);
  };
  fetchData();
  return () => {
    isMounted = false;
  };
}, [dbUserId]);

  // ── 3. Real-time INSERT subscription ─────────────
  useEffect(() => {
    if (!dbUserId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notif-bell-${dbUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${dbUserId}`,
        },
        (payload) => {
          setNotifs((prev) => {
            if (prev.some((n) => n.notification_id === payload.new.notification_id)) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [dbUserId]);

  // ── 4. Close on outside click ─────────────────────
  useEffect(() => {
    function onOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // ── 5. Handlers ───────────────────────────────────
  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    setNotifs((prev) =>
      prev.map((n) => (n.notification_id === id ? { ...n, status: "read" } : n))
    );
  };

  const handleMarkAllRead = async () => {
    if (!dbUserId || unreadCount === 0) return;
    await markAllNotificationsRead(dbUserId);
    setNotifs((prev) => prev.map((n) => ({ ...n, status: "read" })));
  };

  // ── 6. Render ─────────────────────────────────────
  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-flex" }}>

      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
        style={{
          position: "relative",
          background: "none",
          border: "none",
          padding: "5px 7px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          color: "#374151",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
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
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "1px",
              right: "1px",
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
              padding: "0 3px",
              lineHeight: 1,
              boxShadow: "0 0 0 2px #fff",
              pointerEvents: "none",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: "340px",
            maxWidth: "calc(100vw - 24px)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.07)",
            border: "1px solid #e5e7eb",
            zIndex: 10000,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px 10px",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>
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
                    padding: "1px 6px",
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
                  borderRadius: "5px",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "28px 14px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "36px 14px", textAlign: "center" }}>
                <div style={{ fontWeight: 600, color: "#374151", fontSize: "13px", marginBottom: "4px" }}>
                  No notifications yet
                </div>
                <div style={{ color: "#9ca3af", fontSize: "12px" }}>
                  You'll be notified about messages and booking updates
                </div>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = n.status === "unread";
                const label = TYPE_LABELS[n.type] || n.type;
                const description = TYPE_DESCRIPTION[n.type] || "";

                return (
                  <div
                    key={n.notification_id}
                    onClick={() => isUnread && handleMarkRead(n.notification_id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 14px 10px 18px",
                      borderBottom: "1px solid #f9fafb",
                      background: isUnread ? "#fafbff" : "#fff",
                      cursor: isUnread ? "pointer" : "default",
                      position: "relative",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (isUnread) e.currentTarget.style.background = "#f0f3ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread ? "#fafbff" : "#fff";
                    }}
                  >
                    {/* Unread dot */}
                    {isUnread && (
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

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: isUnread ? 600 : 500,
                          fontSize: "13px",
                          color: "#111827",
                          marginBottom: "2px",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                          lineHeight: 1.4,
                        }}
                      >
                        {description}
                      </div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "3px" }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {!loading && notifications.length > 0 && (
            <div
              style={{
                padding: "8px 14px",
                borderTop: "1px solid #f3f4f6",
                textAlign: "center",
              }}
            >
              <button
                onClick={async () => {
                  if (!dbUserId) return;

                  setLoading(true);

                  const { data, error } = await getNotificationsForUser(dbUserId);

                  if (error) {
                    console.warn("[NotificationBell] fetch error:", error.message);
                    setNotifs([]);
                  } else {
                    setNotifs(data || []);
                  }

                  setLoading(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#9ca3af",
                  fontWeight: 500,
                  transition: "color 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#6b7280")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
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