const express = require("express");
const router = express.Router();
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");

/**
 * GET /api/listings
 * Return all active listings with student name and attached skills.
 * Supports optional query params: skill_id, location, max_price, pricing_type
 */
router.get("/", requireAuth, async (req, res) => {
  let query = supabase
    .from("listings")
    .select(`
      listing_id, title, description, status,
      location_text, pricing_type, price_amount, created_at, updated_at,
      student_id,
      users!listings_student_id_fkey(user_id, first_name, last_name),
      listingsskills(skills(skill_id, name))
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Optional filters
  if (req.query.location) {
    query = query.ilike("location_text", `%${req.query.location}%`);
  }
  if (req.query.max_price) {
    query = query.lte("price_amount", Number(req.query.max_price));
  }
  if (req.query.pricing_type) {
    query = query.eq("pricing_type", req.query.pricing_type);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * GET /api/listings/:id
 * Single listing with full details.
 */
router.get("/:id", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("listings")
    .select(`
      *,
      users!listings_student_id_fkey(user_id, first_name, last_name, email),
      listingsskills(skills(skill_id, name))
    `)
    .eq("listing_id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Listing not found" });
  res.json(data);
});

/**
 * POST /api/listings
 * Students only — create a new listing.
 */
router.post("/", requireAuth, async (req, res) => {
  const email = req.user["https://capstone/email"] || req.user.email;

  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", email)
    .single();

  if (userError || !dbUser) return res.status(401).json({ error: "User not found" });
  if (dbUser.role !== "student") return res.status(403).json({ error: "Only students can create listings" });

  const { title, description, location_text, pricing_type, price_amount, skill_ids } = req.body;

  if (!title || !pricing_type || price_amount === undefined) {
    return res.status(400).json({ error: "title, pricing_type, and price_amount are required" });
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .insert({
      student_id: dbUser.user_id,
      title,
      description: description || null,
      location_text: location_text || null,
      pricing_type,
      price_amount: Number(price_amount),
      status: "active",
    })
    .select()
    .single();

  if (listingError) return res.status(500).json({ error: listingError.message });

  // Attach skills if provided
  if (Array.isArray(skill_ids) && skill_ids.length > 0) {
    const skillRows = skill_ids.map((skill_id) => ({
      listing_id: listing.listing_id,
      skill_id,
    }));
    const { error: skillError } = await supabase.from("listingsskills").upsert(skillRows);
    if (skillError) console.warn("Skill attach warning:", skillError.message);
  }

  res.status(201).json(listing);
});

/**
 * PATCH /api/listings/:id
 * Update a listing — owner or admin only.
 */
router.patch("/:id", requireAuth, async (req, res) => {
  const email = req.user["https://capstone/email"] || req.user.email;

  const { data: dbUser } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", email)
    .single();

  const { data: listing } = await supabase
    .from("listings")
    .select("student_id")
    .eq("listing_id", req.params.id)
    .single();

  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const isOwner = dbUser && String(dbUser.user_id) === String(listing.student_id);
  const isAdmin = dbUser && dbUser.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

  const allowed = ["title", "description", "location_text", "pricing_type", "price_amount", "status"];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("listings")
    .update(updates)
    .eq("listing_id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * DELETE /api/listings/:id
 * Soft-delete: sets status to "inactive".
 */
router.delete("/:id", requireAuth, async (req, res) => {
  const email = req.user["https://capstone/email"] || req.user.email;

  const { data: dbUser } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", email)
    .single();

  const { data: listing } = await supabase
    .from("listings")
    .select("student_id")
    .eq("listing_id", req.params.id)
    .single();

  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const isOwner = dbUser && String(dbUser.user_id) === String(listing.student_id);
  const isAdmin = dbUser && dbUser.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

  const { error } = await supabase
    .from("listings")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("listing_id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, message: "Listing deactivated" });
});

module.exports = router;