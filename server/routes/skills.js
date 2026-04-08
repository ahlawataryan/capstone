const express = require("express");
const router = express.Router();
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");

/**
 * GET /api/skills
 * All active skills — used for dropdowns / filters.
 */
router.get("/", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("skills")
    .select("skill_id, name")
    .eq("is_active", true)
    .order("name");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * POST /api/skills   (admin only)
 * Create a new skill.
 */
router.post("/", requireAuth, async (req, res) => {
  const email = req.user["https://capstone/email"] || req.user.email;
  const { data: dbUser } = await supabase
    .from("users")
    .select("role")
    .eq("email", email)
    .single();

  if (!dbUser || dbUser.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const { data, error } = await supabase
    .from("skills")
    .insert({ name, is_active: true })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/**
 * GET /api/skills/student/:studentId
 * All skills attached to a specific student.
 */
router.get("/student/:studentId", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("studentskills")
    .select("proficiency, interest, skills(skill_id, name)")
    .eq("student_id", req.params.studentId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * POST /api/skills/student/:studentId
 * Add / update a skill on a student's profile.
 * Body: { skill_id, proficiency, interest }
 */
router.post("/student/:studentId", requireAuth, async (req, res) => {
  const email = req.user["https://capstone/email"] || req.user.email;
  const { data: dbUser } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", email)
    .single();

  const isOwner = dbUser && String(dbUser.user_id) === String(req.params.studentId);
  const isAdmin = dbUser && dbUser.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

  const { skill_id, proficiency, interest } = req.body;
  if (!skill_id) return res.status(400).json({ error: "skill_id is required" });

  const { data, error } = await supabase
    .from("studentskills")
    .upsert(
      { student_id: Number(req.params.studentId), skill_id, proficiency, interest },
      { onConflict: "student_id,skill_id" }
    )
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/**
 * DELETE /api/skills/student/:studentId/:skillId
 * Remove a skill from a student's profile.
 */
router.delete("/student/:studentId/:skillId", requireAuth, async (req, res) => {
  const email = req.user["https://capstone/email"] || req.user.email;
  const { data: dbUser } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", email)
    .single();

  const isOwner = dbUser && String(dbUser.user_id) === String(req.params.studentId);
  const isAdmin = dbUser && dbUser.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

  const { error } = await supabase
    .from("studentskills")
    .delete()
    .eq("student_id", req.params.studentId)
    .eq("skill_id", req.params.skillId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;