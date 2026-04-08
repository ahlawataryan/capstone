const express = require("express");
const router = express.Router();
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");

async function getDbUser(req) {
  const email = req.user["https://capstone/email"] || req.user.email;
  const { data } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", email)
    .single();
  return data;
}

/**
 * GET /api/notifications
 * Return all notifications for the logged-in user, newest first.
 */
router.get("/", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser) return res.status(401).json({ error: "User not found" });

  const { data, error } = await supabase
    .from("notifications")
    .select("notification_id, type, channel, status, created_at")
    .eq("user_id", dbUser.user_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * POST /api/notifications
 * Internal helper: create a notification for any user.
 * Typically called server-side after booking events, not directly by the client.
 * Body: { user_id, type, channel }
 */
router.post("/", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser || dbUser.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const { user_id, type, channel } = req.body;
  if (!user_id || !type || !channel) {
    return res.status(400).json({ error: "user_id, type, and channel are required" });
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id, type, channel, status: "unread" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read.
 */
router.patch("/:id/read", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser) return res.status(401).json({ error: "User not found" });

  // Verify ownership
  const { data: notif } = await supabase
    .from("notifications")
    .select("user_id")
    .eq("notification_id", req.params.id)
    .single();

  if (!notif) return res.status(404).json({ error: "Notification not found" });
  if (String(notif.user_id) !== String(dbUser.user_id) && dbUser.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("notification_id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * PATCH /api/notifications/read-all
 * Mark all of the current user's notifications as read.
 */
router.patch("/read-all", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser) return res.status(401).json({ error: "User not found" });

  const { error } = await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("user_id", dbUser.user_id)
    .eq("status", "unread");

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;