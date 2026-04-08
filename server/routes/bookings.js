const express = require("express");
const router = express.Router();
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");

// Helper: resolve the Supabase user row from the JWT's email claim.
async function getDbUser(req) {
  const email = req.user["https://capstone/email"] || req.user.email;
  const { data } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", email)
    .single();
  return data;
}

// ─── Booking Requests ────────────────────────────────────────────────────────

/**
 * GET /api/bookings/requests
 * Returns booking requests relevant to the logged-in user.
 *  - client  → requests they sent
 *  - student → requests received for their listings
 *  - admin   → all requests
 */
router.get("/requests", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser) return res.status(401).json({ error: "User not found" });

  let query = supabase
    .from("bookingrequests")
    .select(`
      request_id, status, note, created_at, updated_at,
      requested_start_at, requested_end_at,
      customer_id, listing_id,
      listings(listing_id, title, price_amount, student_id,
        users!listings_student_id_fkey(first_name, last_name))
    `)
    .order("created_at", { ascending: false });

  if (dbUser.role === "client") {
    query = query.eq("customer_id", dbUser.user_id);
  } else if (dbUser.role === "student") {
    // Requests for listings owned by this student — use inner join filter
    query = supabase
      .from("bookingrequests")
      .select(`
        request_id, status, note, created_at, updated_at,
        requested_start_at, requested_end_at, customer_id, listing_id,
        listings!inner(listing_id, title, price_amount, student_id),
        users!bookingrequests_customer_id_fkey(first_name, last_name, email)
      `)
      .eq("listings.student_id", dbUser.user_id)
      .order("created_at", { ascending: false });
  }
  // admin: no extra filter — gets everything

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * POST /api/bookings/requests
 * Client sends a hire request for a listing.
 */
router.post("/requests", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser) return res.status(401).json({ error: "User not found" });
  if (dbUser.role !== "client") return res.status(403).json({ error: "Only clients can send hire requests" });

  const { listing_id, requested_start_at, requested_end_at, note } = req.body;
  if (!listing_id || !requested_start_at || !requested_end_at) {
    return res.status(400).json({ error: "listing_id, requested_start_at, and requested_end_at are required" });
  }

  const { data, error } = await supabase
    .from("bookingrequests")
    .insert({
      customer_id: dbUser.user_id,
      listing_id,
      requested_start_at,
      requested_end_at,
      note: note || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/**
 * PATCH /api/bookings/requests/:id
 * Student accepts / declines. Client can cancel their own request.
 */
router.patch("/requests/:id", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser) return res.status(401).json({ error: "User not found" });

  const { status } = req.body;
  const validStatuses = ["accepted", "declined", "cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
  }

  const { data: request } = await supabase
    .from("bookingrequests")
    .select("request_id, customer_id, listing_id, listings(student_id)")
    .eq("request_id", req.params.id)
    .single();

  if (!request) return res.status(404).json({ error: "Request not found" });

  const isClient = String(dbUser.user_id) === String(request.customer_id);
  const isStudent = String(dbUser.user_id) === String(request.listings?.student_id);
  const isAdmin = dbUser.role === "admin";

  if (!isClient && !isStudent && !isAdmin) return res.status(403).json({ error: "Forbidden" });
  if (isClient && status !== "cancelled") return res.status(403).json({ error: "Clients may only cancel their own requests" });

  const { data, error } = await supabase
    .from("bookingrequests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("request_id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // If accepted, also create the confirmed booking row.
  if (status === "accepted") {
    const { error: bookingError } = await supabase.from("bookings").insert({
      request_id: request.request_id,
      customer_id: request.customer_id,
      listing_id: request.listing_id,
      start_at: data.requested_start_at,
      end_at: data.requested_end_at,
      status: "confirmed",
      agreed_price_amount: 0, // updated separately via payments flow
    });
    if (bookingError) console.warn("Booking auto-create warning:", bookingError.message);
  }

  res.json(data);
});

// ─── Confirmed Bookings ───────────────────────────────────────────────────────

/**
 * GET /api/bookings
 * Returns confirmed bookings for the current user.
 */
router.get("/", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser) return res.status(401).json({ error: "User not found" });

  let query;

  if (dbUser.role === "client") {
    query = supabase
      .from("bookings")
      .select(`
        bookings_id, status, start_at, end_at, agreed_price_amount, created_at,
        listings(title, users!listings_student_id_fkey(first_name, last_name))
      `)
      .eq("customer_id", dbUser.user_id)
      .order("start_at");
  } else if (dbUser.role === "student") {
    query = supabase
      .from("bookings")
      .select(`
        bookings_id, status, start_at, end_at, agreed_price_amount, created_at, customer_id,
        listings!inner(listing_id, title, student_id),
        users!bookings_customer_id_fkey(first_name, last_name, email)
      `)
      .eq("listings.student_id", dbUser.user_id)
      .order("start_at");
  } else {
    // admin — all bookings
    query = supabase
      .from("bookings")
      .select("*")
      .order("start_at");
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * PATCH /api/bookings/:id
 * Update booking status: "completed" | "cancelled"
 */
router.patch("/:id", requireAuth, async (req, res) => {
  const dbUser = await getDbUser(req);
  if (!dbUser) return res.status(401).json({ error: "User not found" });

  const { status } = req.body;
  if (!["completed", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "status must be 'completed' or 'cancelled'" });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("bookings_id, customer_id, listings(student_id)")
    .eq("bookings_id", req.params.id)
    .single();

  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isParticipant =
    String(dbUser.user_id) === String(booking.customer_id) ||
    String(dbUser.user_id) === String(booking.listings?.student_id);

  if (!isParticipant && dbUser.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("bookings_id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;