const express = require("express");
const router = express.Router();
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");

/**
 * GET /api/me
 * Returns the current user's Supabase row (role, profile etc.).
 */
router.get("/me", requireAuth, async (req, res) => {
  const email =
    req.user["https://capstone/email"] || req.user.email || null;

  if (!email) return res.status(400).json({ error: "No email in token" });

  const { data, error } = await supabase
    .from("users")
    .select("user_id, email, role, first_name, last_name, phone, bio, created_at")
    .eq("email", email)
    .single();

  if (error) return res.status(404).json({ error: "User not found" });
  res.json(data);
});

/**
 * POST /api/auth/sync
 * Called by the frontend on every login.
 * Creates the user row in Supabase if it does not exist yet, then returns their role.
 */
router.post("/sync", requireAuth, async (req, res) => {
  const email =
    req.user["https://capstone/email"] || req.user.email || null;

  if (!email) return res.status(400).json({ error: "No email claim in token" });

  // Try to find the existing row first.
  const { data: existing } = await supabase
    .from("users")
    .select("user_id, role, email, first_name, last_name, created_at")
    .eq("email", email)
    .single();

  if (existing) return res.json(existing);

  // New user — insert with default role "client".
  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({ email, role: "client" })
    .select("user_id, role, email, first_name, last_name, created_at")
    .single();

  if (insertError) {
    console.error("Auth sync insert error:", insertError);
    return res.status(500).json({ error: "Failed to create user", detail: insertError.message });
  }

  res.status(201).json(created);
});

/**
 * POST /api/auth/dev-set-role   (remove in production)
 * Quickly sets your own role during development.
 */
router.post("/dev-set-role", requireAuth, async (req, res) => {
  const { role } = req.body;
  if (!["admin", "client", "student"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const email = req.user["https://capstone/email"] || req.user.email;

  const { data, error } = await supabase
    .from("users")
    .update({ role })
    .eq("email", email)
    .select("user_id, role, email")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, ...data });
});

module.exports = router;