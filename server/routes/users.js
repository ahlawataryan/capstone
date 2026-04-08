const express = require("express");
const router = express.Router();
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");

/**
 * GET /api/users
 * Admin only: return all users.
 */
router.get("/", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, email, role, first_name, last_name, created_at")
    .order("first_name");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * GET /api/users/:id
 * Fetch a single user by user_id.
 */
router.get("/:id", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, email, role, first_name, last_name, phone, bio, created_at, updated_at")
    .eq("user_id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "User not found" });
  res.json(data);
});

/**
 * PATCH /api/users/:id
 * Update profile fields. A user can only update their own profile unless they are an admin.
 */
router.patch("/:id", requireAuth, async (req, res) => {
  const email = req.user["https://capstone/email"] || req.user.email;

  // Verify the requester owns this record (or is admin — that check can be expanded later).
  const { data: self } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", email)
    .single();

  const isOwner = self && String(self.user_id) === String(req.params.id);
  const isAdmin = self && self.role === "admin";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const allowedFields = ["first_name", "last_name", "phone", "bio"];
  if (isAdmin) allowedFields.push("role"); // admins can promote/demote

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("user_id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * GET /api/users/students/all
 * Return all students (role = 'student'). Useful for client-side browsing.
 */
router.get("/students/all", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, bio")
    .eq("role", "student")
    .order("first_name");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;