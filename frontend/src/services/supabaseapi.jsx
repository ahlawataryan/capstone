import { supabase } from "../supabaseconfig";
/*
File to contain wrapper functions that can call supabase functions. 
Supabase configured in supabaseconfig.js
Supabase installed on system using scoop in command line
Supabase commands to retrieve and set up database. Connection should be made already,
so these are for set up. Need docker desktop running
supabase start
supabase migration up
supabase push
supabase pull
Dependencies:
supabase
supabase-js
*/

/*
  supabaseapi.jsx
  ---------------
  Centralised wrapper functions for all Supabase calls.
  Import individual functions wherever you need them:

    import { getUserByEmail, upsertUser } from "../api/supabaseapi";

  Every function returns the raw { data, error } object from Supabase
  unless noted otherwise, so callers can handle errors themselves.

  Table quick-reference
  ─────────────────────
  users              – user_id, email, role, first_name, last_name, phone, bio, created_at, updated_at
  listings           – listing_id, student_id, title, description, status, location_text, pricing_type, price_amount, created_at, updated_at
  skills             – skill_id, name, is_active
  studentskills      – student_id, skill_id, proficiency, interest
  listingsskills     – listing_id, skill_id
  availabilityslots  – slot_id, student_id, start_at, end_at, status
  bookingrequests    – request_id, customer_id, listing_id, requested_start_at, requested_end_at, note, status, created_at, updated_at
  bookings           – bookings_id, request_id, customer_id, listing_id, start_at, end_at, status, agreed_price_amount, created_at, updated_at
  conversations      – conversation_id, booking_id, request_id, created_at, recipient_user_id, initiator_user_id
  messages           – message_id, conversation_id, sender_user_id, body, sent_at, read_at
  notifications      – notification_id, user_id, type, channel, status, created_at
  payments           – payment_id, booking_id, customer_id, student_id, amount, status, provider, provider_payment_id, created_at, paid_at
  reviews            – review_id, booking_id, reviewer_user_id, reviewee_user_id, rating, comment, created_at
*/

// ─────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────

/** Get all users. Used for admin dashboard and messaging user lists. */
export async function getAllUsers() {
  return await supabase
    .from("users")
    .select(`
      user_id,
      first_name,
      last_name,
      email,
      role,
      is_active,
      delete_requested,
      delete_request_reason,
      account_status,
      report_count
    `)
    .order("user_id", { ascending: true });
}

/** Fetch a single user by email. Used after Auth0 login to load profile + role. */
export async function getUserByEmail(email) {
  return await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
}

/** Fetch a single user by their numeric user_id. */
export async function getUserById(userId) {
  return await supabase
    .from("users")
    .select("*")
    .eq("user_id", userId)
    .single();
}

/**
 * Insert a new user row, or update it if the email already exists.
 * Pass any subset of: { email, role, first_name, last_name, phone, bio }
 *
 * Example – create on first login:
 *   await upsertUser({ email: user.email, role: "client" });
 *
 * Example – update profile fields:
 *   await upsertUser({ email: user.email, first_name: "Rory", bio: "..." });
 */
export async function upsertUser({ email, role, first_name, last_name, phone, bio }) {
  return await supabase
    .from("users")
    .upsert(
      { email, role, first_name, last_name, phone, bio },
      { onConflict: "email" }
    )
    .select()
    .single();
}

/**
 * Insert a new user row, or update it if the email already exists.
 * Pass any subset of: { email, role, first_name, last_name, phone, bio }
 * This isn't strictly necessary, but it's meant to be an additional security level
 * in case some loophole to create an account with the same email is found
 *
 * Example – create on first login:
 *   await upsertUser({ email: user.email, role: "client" });
 *
 * Example – update profile fields:
 *   await upsertUser({ email: user.email, first_name: "Rory", bio: "..." });
 */
export async function insertUser({ email, role, first_name, last_name, phone, bio }){
  return await supabase
    .from("users")
    .insert(
      { email: email, role: role, first_name: first_name, last_name: last_name, phone: phone, bio: bio }
    )
    .select()
    .single();
}

/** Update specific profile fields for a user (by user_id). */
export async function updateUserProfile(userId, fields) {
  return await supabase
    .from("users")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select()
    .single();
}

export async function updateUser(email, updates) {
  return await supabase
    .from("users")
    .update(updates)
    .eq("email", email)
    .select()
    .single();
}
/*
Add a file to storage. File accessed using a url in the user table
Takes an email for user reference, file url for the name, file itself
*/
export async function updateIcon(fileurl, file){
  return await supabase
  .storage
  .from('icons')
  .upload(fileurl, file, {upsert : true, contentType: "/image/jpeg"});
}

/*
Get an image from storage. The url should be possible to display with like an </img> block
I have no idea why this isn't a promise like the rest of them, but it works
*/
export function getIcon(fileurl){
  return supabase.storage.from('icons').getPublicUrl(fileurl);
}

export async function setUserIcon(email, fileurl){
  return await supabase
  .from("users")
  .update({icon_url : fileurl})
  .eq("email", email)
  .select();
}

/*
Delete an image from storage using a url. May need to be an array as an argument.
*/
export async function deleteIcon(fileurl) {
  return await supabase.storage.from("icons").remove([fileurl]);
}

// ─────────────────────────────────────────────────
// SKILLS
// ─────────────────────────────────────────────────

/** Get all active skills (for dropdowns / filter UI). */
export async function getAllSkills() {
  return await supabase
    .from("skills")
    .select("skill_id, name")
    .eq("is_active", true)
    .order("name");
}

/** Get all skills that belong to a specific student. */
export async function getSkillsForStudent(studentId) {
  return await supabase
    .from("studentskills")
    .select("proficiency, interest, skills(skill_id, name)")
    .eq("student_id", studentId);
}

/**
 * Add or update a skill on a student's profile.
 * proficiency and interest are integers (e.g. 1–5).
 */
export async function upsertStudentSkill(studentId, skillId, proficiency, interest) {
  return await supabase
    .from("studentskills")
    .upsert(
      { student_id: studentId, skill_id: skillId, proficiency, interest },
      { onConflict: "student_id,skill_id" }
    );
}

/** Remove a skill from a student's profile. */
export async function removeStudentSkill(studentId, skillId) {
  return await supabase
    .from("studentskills")
    .delete()
    .eq("student_id", studentId)
    .eq("skill_id", skillId);
}

/**
 * Get all students that have a specific skill.
 * Returns user rows joined through studentskills.
 * Pass a skill name string (e.g. "React") or a skill_id number.
 *
 * Usage (by name):  getStudentsBySkillName("React")
 * Usage (by id):    getStudentsBySkillId(3)
 */
export async function getStudentsBySkillName(skillName) {
  // First resolve the skill name to an id
  const { data: skill, error: skillError } = await supabase
    .from("skills")
    .select("skill_id")
    .eq("name", skillName)
    .single();

  if (skillError) return { data: null, error: skillError };
  return getStudentsBySkillId(skill.skill_id);
}

export async function getStudentsBySkillId(skillId) {
  return await supabase
    .from("studentskills")
    .select("student_id, proficiency, users(user_id, email, first_name, last_name, bio)")
    .eq("skill_id", skillId);
}


// ─────────────────────────────────────────────────
// LISTINGS  (student service listings)
// ─────────────────────────────────────────────────

/** Get all active listings, newest first. Good for the client "browse" page. */
export async function getActiveListings() {
  return await supabase
    .from("listings")
    .select(`
      listing_id, title, description, status, location_text, pricing_type, price_amount, created_at, student_id, 
      users!listings_student_id_fkey(user_id, first_name, last_name, email, phone, bio, icon_url), 
      listingsskills(skills(skill_id, name))
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false });
}

/** Get all listings created by a specific student, including skills and booking status. */
export async function getListingsByStudent(studentId) {
  return await supabase
    .from("listings")
    .select("*, listingsskills(skills(skill_id, name)), bookings(bookings_id, status)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
}

/** Get a single listing by id (includes the student's name). */
export async function getListingById(listingId) {
  return await supabase
    .from("listings")
    .select(`
      *,
      users(user_id, first_name, last_name, email),
      listingsskills(skills(skill_id, name))
    `)
    .eq("listing_id", listingId)
    .single();
}

/**
 * Create a new listing.
 * Required fields: { student_id, title, status, pricing_type, price_amount }
 * Optional:        { description, location_text }
 */
export async function createListing({ student_id, title, description, status = "active",
                                      location_text, pricing_type, price_amount }) {
  return await supabase
    .from("listings")
    .insert({ student_id, title, description, status, location_text, pricing_type, price_amount })
    .select()
    .single();
}

/** Update fields on an existing listing. Pass only the fields you want to change. */
export async function updateListing(listingId, fields) {
  return await supabase
    .from("listings")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("listing_id", listingId)
    .select()
    .single();
}

/** Soft-delete: set a listing's status to "inactive". Used by students on their own listings. */
export async function deactivateListing(listingId) {
  return updateListing(listingId, { status: "inactive" });
}

/**
 * Hard-delete a listing and all its associated skill tags.
 * This is the reverse of createListing + addSkillToListing — for admin use only.
 * Deletes listingsskills rows first (FK constraint), then the listing itself.
 */
export async function hardDeleteListing(listingId) {
  const { error: skillsError } = await supabase
    .from("listingsskills")
    .delete()
    .eq("listing_id", listingId);

  if (skillsError) return { data: null, error: skillsError };

  return await supabase
    .from("listings")
    .delete()
    .eq("listing_id", listingId);
}

/** Attach a skill tag to a listing. */
export async function addSkillToListing(listingId, skillId) {
  return await supabase
    .from("listingsskills")
    .upsert({ listing_id: listingId, skill_id: skillId }, { onConflict: "listing_id,skill_id" });
}

/** Remove a skill tag from a listing. */
export async function removeSkillFromListing(listingId, skillId) {
  return await supabase
    .from("listingsskills")
    .delete()
    .eq("listing_id", listingId)
    .eq("skill_id", skillId);
}

/**
 * Filter active listings by skill id.
 * Used on the client "browse" page when a skill filter is selected.
 */
export async function getListingsBySkill(skillId) {
  return await supabase
    .from("listingsskills")
    .select(`
      listings(
        listing_id, title, description, status,
        location_text, pricing_type, price_amount, created_at,
        users(user_id, first_name, last_name, email)
      )
    `)
    .eq("skill_id", skillId)
    .eq("listings.status", "active");
}

// ─────────────────────────────────────────────────
// AVAILABILITY SLOTS
// ─────────────────────────────────────────────────

/** Get all availability slots for a student. */
export async function getAvailabilityForStudent(studentId) {
  return await supabase
    .from("availabilityslots")
    .select("*")
    .eq("student_id", studentId)
    .order("start_at");
}

/** Add an availability slot for a student. status: "open" | "booked" */
export async function addAvailabilitySlot(studentId, startAt, endAt, status = "open") {
  return await supabase
    .from("availabilityslots")
    .insert({ student_id: studentId, start_at: startAt, end_at: endAt, status })
    .select()
    .single();
}

/** Update a slot's status (e.g. mark as "booked" when confirmed). */
export async function updateSlotStatus(slotId, status) {
  return await supabase
    .from("availabilityslots")
    .update({ status })
    .eq("slot_id", slotId)
    .select()
    .single();
}

// ─────────────────────────────────────────────────
// BOOKING REQUESTS
// ─────────────────────────────────────────────────

/**
 * Create a booking request (client → student).
 * Required: { customer_id, listing_id, requested_start_at, requested_end_at }
 * Optional: { note }
 * status defaults to "pending".
 */
export async function createBookingRequest({
  customer_id, listing_id, requested_start_at, requested_end_at, note
}) {
  return await supabase
    .from("bookingrequests")
    .insert({
      customer_id,
      listing_id,
      requested_start_at,
      requested_end_at,
      note,
      status: "pending",
    })
    .select()
    .single();
}

/** Get all booking requests sent by a specific client. */
export async function getBookingRequestsByClient(customerId) {
  return await supabase
    .from("bookingrequests")
    .select(`
      *,
      listings(listing_id, title, price_amount, student_id, users(user_id, first_name, last_name))
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
}

/** Get all booking requests received for a student's listings. */
export async function getBookingRequestsForStudent(studentId) {
  return await supabase
    .from("bookingrequests")
    .select(`
      *,
      listings!inner(listing_id, title, student_id),
      users(user_id, first_name, last_name, email)
    `)
    .eq("listings.student_id", studentId)
    .order("created_at", { ascending: false });
}

/**
 * Update the status of a booking request.
 * status options: "pending" | "accepted" | "declined" | "cancelled"
 */
export async function updateBookingRequestStatus(requestId, status) {
  return await supabase
    .from("bookingrequests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .select()
    .single();
}

// ─────────────────────────────────────────────────
// BOOKINGS  (confirmed, after request accepted)
// ─────────────────────────────────────────────────

/**
 * Confirm a booking request by creating a bookings row.
 * Call this after updateBookingRequestStatus(requestId, "accepted").
 */
export async function createBooking({
  request_id, customer_id, listing_id, start_at, end_at, agreed_price_amount
}) {
  return await supabase
    .from("bookings")
    .insert({
      request_id,
      customer_id,
      listing_id,
      start_at,
      end_at,
      status: "confirmed",
      agreed_price_amount,
    })
    .select()
    .single();
}

/** Get all bookings for a client. */
export async function getBookingsByClient(customerId) {
  return await supabase
    .from("bookings")
    .select(`
      *,
      listings(listing_id, title, student_id, users(user_id, first_name, last_name))
    `)
    .eq("customer_id", customerId)
    .order("start_at");
}

/** Get all confirmed bookings for a student (via their listings). */
export async function getBookingsForStudent(studentId) {
  const { data: listingsData, error: listingsError } = await supabase
    .from("listings")
    .select("listing_id")
    .eq("student_id", studentId);

  if (listingsError) return { data: null, error: listingsError };

  const listingIds = (listingsData || []).map((l) => l.listing_id);
  if (listingIds.length === 0) return { data: [], error: null };

  return await supabase
    .from("bookings")
    .select(`
      *,
      listings(listing_id, title, student_id),
      users(user_id, first_name, last_name, email)
    `)
    .in("listing_id", listingIds)
    .order("start_at");
}

/** Get all confirmed bookings for a client with full listing details. Used on the Jobs page "Active Listings" tab. */
export async function getActiveBookingListingsForClient(customerId) {
  return await supabase
    .from("bookings")
    .select(`
      bookings_id, start_at, end_at, agreed_price_amount, status,
      listings(
        listing_id, title, description, location_text, pricing_type, price_amount,
        users!listings_student_id_fkey(user_id, first_name, last_name),
        listingsskills(skills(skill_id, name))
      )
    `)
    .eq("customer_id", customerId)
    .eq("status", "confirmed")
    .order("start_at");
}

/** Update a booking's status. status: "confirmed" | "completed" | "cancelled" */
export async function updateBookingStatus(bookingId, status) {
  return await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("bookings_id", bookingId)
    .select()
    .single();
}

export async function getCompletedBookingsForClientAndStudent(clientUserId, studentUserId) {
  return await supabase
    .from("bookings")
    .select(`
      bookings_id,
      status,
      customer_id,
      listing_id,
      listings!inner(
        listing_id,
        student_id,
        title
      )
    `)
    .eq("customer_id", clientUserId)
    .eq("status", "completed")
    .eq("listings.student_id", studentUserId)
    .order("bookings_id", { ascending: false });
}

// ─────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────

/** Get reviews for a student (latest first), including reviewer info and category ratings. */
export async function getReviewsForStudent(revieweeUserId) {
  return await supabase
    .from("reviews")
    .select(`
      review_id,
      booking_id,
      reviewer_user_id,
      reviewee_user_id,
      rating,
      work_quality_rating,
      communication_rating,
      professionalism_rating,
      reliability_rating,
      comment,
      created_at,
      users!reviews_reviewer_user_id_fkey (
        user_id,
        first_name,
        last_name,
        email
      )
    `)
    .eq("reviewee_user_id", revieweeUserId)
    .order("created_at", { ascending: false });
}

/**
 * Get full review analytics for a student.
 * Returns:
 * {
 *   avg,
 *   count,
 *   workQualityAvg,
 *   communicationAvg,
 *   professionalismAvg,
 *   reliabilityAvg,
 *   distribution: { 5, 4, 3, 2, 1 }
 * }
 */
export async function getReviewSummary(revieweeUserId) {
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      rating,
      work_quality_rating,
      communication_rating,
      professionalism_rating,
      reliability_rating
    `)
    .eq("reviewee_user_id", revieweeUserId);

  if (error) return { data: null, error };

  const reviews = data || [];
  const count = reviews.length;

  if (count === 0) {
    return {
      data: {
        avg: 0,
        count: 0,
        workQualityAvg: 0,
        communicationAvg: 0,
        professionalismAvg: 0,
        reliabilityAvg: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
      error: null,
    };
  }

  const average = (values) =>
    Math.round(
      (values.reduce((sum, value) => sum + Number(value || 0), 0) / count) * 10
    ) / 10;

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  reviews.forEach((review) => {
    const rounded = Math.round(Number(review.rating || 0));
    if (distribution[rounded] !== undefined) {
      distribution[rounded] += 1;
    }
  });

  return {
    data: {
      avg: average(reviews.map((r) => r.rating)),
      count,
      workQualityAvg: average(reviews.map((r) => r.work_quality_rating)),
      communicationAvg: average(reviews.map((r) => r.communication_rating)),
      professionalismAvg: average(reviews.map((r) => r.professionalism_rating)),
      reliabilityAvg: average(reviews.map((r) => r.reliability_rating)),
      distribution,
    },
    error: null,
  };
}

/**
 * Create or update a review.
 * Supports detailed category ratings and editing existing reviews.
 */
export async function upsertReview({
  reviewId = null,
  bookingId = null,
  reviewerUserId,
  revieweeUserId,
  rating,
  workQualityRating,
  communicationRating,
  professionalismRating,
  reliabilityRating,
  comment,
}) {
  const payload = {
    booking_id: bookingId,
    reviewer_user_id: reviewerUserId,
    reviewee_user_id: revieweeUserId,
    rating,
    work_quality_rating: workQualityRating,
    communication_rating: communicationRating,
    professionalism_rating: professionalismRating,
    reliability_rating: reliabilityRating,
    comment,
  };

  if (reviewId) {
    return await supabase
      .from("reviews")
      .update(payload)
      .eq("review_id", reviewId)
      .select()
      .single();
  }

  return await supabase
    .from("reviews")
    .insert(payload)
    .select()
    .single();
}

/** Delete a review by review_id. */
export async function deleteReview(reviewId) {
  return await supabase
    .from("reviews")
    .delete()
    .eq("review_id", reviewId);
}

/**
 * Get a single review left by a reviewer for a specific student.
 * Useful if you want to prefill edit form or enforce one review per reviewer/student.
 */
export async function getReviewByReviewerAndStudent(reviewerUserId, revieweeUserId) {
  return await supabase
    .from("reviews")
    .select(`
      review_id,
      booking_id,
      reviewer_user_id,
      reviewee_user_id,
      rating,
      work_quality_rating,
      communication_rating,
      professionalism_rating,
      reliability_rating,
      comment,
      created_at
    `)
    .eq("reviewer_user_id", reviewerUserId)
    .eq("reviewee_user_id", revieweeUserId)
    .maybeSingle();
}
// ─────────────────────────────────────────────────
// JOB SEARCHING
// ─────────────────────────────────────────────────
//I probably don't need to get the skill names. The entry can just use the id,
//then get them in another function for display. It would clean this up a bit
/*
Search for jobs using skills. Order by average rating
The data used can be handled more on the front end side.
Takes skills in a format like (1, 2)
Only returns the number from numReturn. Calls can double this
*/
export async function getJobsBySkillsRatings(skills, numReturn) {
  return await supabase
  .from('listings')
  .select(`
    listing_id,
    student_id,
    title,
    description,
    status,
    location_text,
    pricing_type,
    price_amount,
    updated_at,
    users!inner(first_name, last_name),
    listingsskills!inner(skill_id)
  `)
  .eq('status', 'active')
  .in('listingsskills.skill_id', skills)
  .limit(numReturn)
}

/*
Search for jobs using skills. Order by updated time
The data used can be handled more on the front end side.
Takes skills in a format like (1, 2)
Only returns the number from numReturn. Calls can double this
*/
export async function getJobsBySkillsTime(skills, numReturn){
  return await supabase
  .from('listings')
  .select(`
    listing_id,
    student_id,
    title,
    description,
    status,
    location_text,
    pricing_type,
    price_amount,
    updated_at,
    users!inner(first_name, last_name),
    listingsskills!inner(skill_id)
  `)
  .eq('status', 'active')
  .in('listingsskills.skill_id', skills)
  .order('updated_at', { ascending: false })
  .limit(numReturn)
}

// ─────────────────────────────────────────────────
// Messages / Conversations
// ─────────────────────────────────────────────────

export async function createConversation({ initiatorUserId, recipientUserId }) {
  return await supabase
    .from("conversations")
    .insert({
      request_id: null, booking_id: null,
      initiator_user_id: initiatorUserId,
      recipient_user_id: recipientUserId,
    })
    .select("conversation_id, created_at, initiator_user_id, recipient_user_id")
    .single();
}

export async function sendMessage({ conversationId, senderUserId, body }) {
  return await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_user_id: senderUserId,
      body,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();
}

export async function getMessagesForConversation(conversationId) {
  return await supabase
    .from("messages")
    .select(`
      message_id,
      body,
      sent_at,
      sender_user_id,
      users!messages_sender_user_id_fkey (
        first_name,
        last_name
      )
    `)
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });
}

export async function getConversationsForUser(userId) {
  return await supabase
    .from("conversations")
    .select(`
      conversation_id, created_at,
      initiator_user_id, recipient_user_id,
      initiator:users!conversations_initiator_user_id_fkey(user_id, first_name, last_name),
      recipient:users!conversations_recipient_user_id_fkey(user_id, first_name, last_name),
      messages(message_id, body, sent_at, sender_user_id)
    `)
    .or(`initiator_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .order("created_at", { ascending: false });
}
/*
There's no reason for multiple conversations between the same user to exist. Checks if one exists before making a new one
*/
export async function doesConvoExist(senderId, receiverId) {
  return await supabase 
  .from("conversations")
  .select(`recipient_user_id, initiator_user_id`)
  .or(`and(initiator_user_id.eq.${senderId}, recipient_user_id.eq.${receiverId}), and(recipient_user_id.eq.${senderId}, initiator_user_id.eq.${receiverId}))`);
}


export async function deactivateUser(userId) {
  return await supabase
    .from("users")
    .update({
      is_active: false,
      account_status: "deleted",
    })
    .eq("user_id", userId);
}

export async function approveDeletionRequest(userId) {
  return await supabase
    .from("users")
    .update({
      is_active: false,
      delete_requested: false,
      delete_request_status: "approved",
      delete_request_review_note:
        "Your deletion request was approved and your account has been closed.",
      account_status: "deleted",
    })
    .eq("user_id", userId)
    .select()
    .single();
}

export async function rejectDeletionRequest(userId, reason) {
  return await supabase
    .from("users")
    .update({
      delete_requested: false,
      delete_request_status: "denied",
      delete_request_review_note: reason,
      account_status: "active",
    })
    .eq("user_id", userId)
    .select()
    .single();
}

export async function requestAccountDeletion(userId, reason) {
  return await supabase
    .from("users")
    .update({
      delete_requested: true,
      delete_request_reason: reason,
      delete_request_status: "pending",
      delete_request_review_note: null,
      account_status: "deletion_requested",
    })
    .eq("user_id", userId)
    .select()
    .single();
}

export async function hardDeleteUser(userId) {
  return await supabase
    .from("users")
    .delete()
    .eq("user_id", userId);
}

export async function hardDeleteUserAccount(userId) {
  return await supabase.rpc("hard_delete_user_account", {
    target_user_id: userId,
  });
}


export async function createListingReport({
  listingId,
  reportedByUserId,
  listingOwnerUserId,
  reason,
  details,
}) {
  return await supabase
    .from("listing_reports")
    .insert({
      listing_id: listingId,
      reported_by_user_id: reportedByUserId,
      listing_owner_user_id: listingOwnerUserId,
      reason,
      details,
      status: "pending",
    })
    .select()
    .single();
}

export async function createUserReport({
  reportedUserId,
  reportedByUserId,
  reason,
  details,
}) {
  // Insert the report record
  const result = await supabase
    .from("user_reports")
    .insert({
      reported_user_id: reportedUserId,
      reported_by_user_id: reportedByUserId,
      reason,
      details,
      status: "pending",
    })
    .select()
    .single();

  if (result.error) return result;

  // Increment report_count on the reported user so the admin Users tab flags them.
  // Read-then-write is acceptable here (capstone, non-critical race condition).
  try {
    const { data: userData } = await supabase
      .from("users")
      .select("report_count")
      .eq("user_id", reportedUserId)
      .single();

    if (userData) {
      await supabase
        .from("users")
        .update({ report_count: (userData.report_count || 0) + 1 })
        .eq("user_id", reportedUserId);
    }
  } catch (err) {
    // Non-fatal — report was created, count update is best-effort
    console.warn("Could not increment report_count:", err);
  }

  return result;
}


export async function getPendingListingReports() {
  return await supabase
    .from("listing_reports")
    .select(`
      report_id,
      listing_id,
      listing_owner_user_id,
      reported_by_user_id,
      reason,
      details,
      status,
      admin_note,
      created_at,
      listings (
        listing_id,
        title,
        location_text,
        price_amount,
        pricing_type,
        student_id
      ),
      owner:users!listing_reports_listing_owner_user_id_fkey (
        user_id,
        first_name,
        last_name,
        email
      ),
      reported_by:users!listing_reports_reported_by_user_id_fkey (
        user_id,
        first_name,
        last_name,
        email
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
}
export async function getPendingUserReports() {
  return await supabase
    .from("user_reports")
    .select(`
      report_id,
      reported_user_id,
      reported_by_user_id,
      reason,
      details,
      status,
      created_at,
      reported_user:users!user_reports_reported_user_id_fkey (
        user_id,
        first_name,
        last_name,
        email
      ),
      reported_by:users!user_reports_reported_by_user_id_fkey (
        user_id,
        first_name,
        last_name,
        email
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
}



/**
 * Hard-delete a listing and ALL related data in dependency order.
 * Done in JS to avoid FK constraint errors without requiring a new migration.
 * Cascade order:
 *   reviews → payments → bookings → bookingrequests
 *   → listing_reports → listingsskills → listings
 */
export async function hardDeleteListingFull(listingId) {
  // 1. Find all confirmed booking IDs for this listing (needed for reviews/payments)
  const { data: bookingRows, error: bookingFetchErr } = await supabase
    .from("bookings")
    .select("bookings_id")
    .eq("listing_id", listingId);

  if (bookingFetchErr) return { data: null, error: bookingFetchErr };

  const bookingIds = (bookingRows || []).map((b) => b.bookings_id);

  // 2. Delete reviews tied to those bookings
  if (bookingIds.length > 0) {
    const { error: reviewsErr } = await supabase
      .from("reviews")
      .delete()
      .in("booking_id", bookingIds);
    if (reviewsErr) return { data: null, error: reviewsErr };

    // 3. Delete payments tied to those bookings
    const { error: paymentsErr } = await supabase
      .from("payments")
      .delete()
      .in("booking_id", bookingIds);
    if (paymentsErr) return { data: null, error: paymentsErr };
  }

  // 4. Delete confirmed bookings for this listing
  const { error: bookingsErr } = await supabase
    .from("bookings")
    .delete()
    .eq("listing_id", listingId);
  if (bookingsErr) return { data: null, error: bookingsErr };

  // 5. Delete booking requests for this listing (was the FK error root cause)
  const { error: requestsErr } = await supabase
    .from("bookingrequests")
    .delete()
    .eq("listing_id", listingId);
  if (requestsErr) return { data: null, error: requestsErr };

  // 6. Delete listing reports
  const { error: reportsErr } = await supabase
    .from("listing_reports")
    .delete()
    .eq("listing_id", listingId);
  if (reportsErr) return { data: null, error: reportsErr };

  // 7. Delete skill tags
  const { error: skillsErr } = await supabase
    .from("listingsskills")
    .delete()
    .eq("listing_id", listingId);
  if (skillsErr) return { data: null, error: skillsErr };

  // 8. Finally delete the listing itself
  return await supabase
    .from("listings")
    .delete()
    .eq("listing_id", listingId);
}

export async function sendAdminMessageToUser(adminUserId, targetUserId, body) {
  const { data: existingConvo, error: convoCheckError } = await doesConvoExist(
    adminUserId,
    targetUserId
  );

  if (convoCheckError) {
    return { data: null, error: convoCheckError };
  }

  let conversationId = null;

  if (existingConvo && existingConvo.length > 0) {
    const { data: convoData, error: convoFetchError } = await supabase
      .from("conversations")
      .select("conversation_id")
      .or(
        `and(initiator_user_id.eq.${adminUserId},recipient_user_id.eq.${targetUserId}),and(initiator_user_id.eq.${targetUserId},recipient_user_id.eq.${adminUserId})`
      )
      .limit(1)
      .single();

    if (convoFetchError) {
      return { data: null, error: convoFetchError };
    }

    conversationId = convoData.conversation_id;
  } else {
    const { data: newConvo, error: newConvoError } = await createConversation({
      initiatorUserId: adminUserId,
      recipientUserId: targetUserId,
    });

    if (newConvoError) {
      return { data: null, error: newConvoError };
    }

    conversationId = newConvo.conversation_id;
  }

  return await sendMessage({
    conversationId,
    senderUserId: adminUserId,
    body,
  });
}

export async function resolveListingReport(reportId, status = "resolved", adminNote = null) {
  return await supabase
    .from("listing_reports")
    .update({
      status,
      admin_note: adminNote,
    })
    .eq("report_id", reportId)
    .select()
    .single();
}

export async function resolveUserReport(reportId, status = "resolved", adminNote = null) {
  return await supabase
    .from("user_reports")
    .update({
      status,
      admin_note: adminNote,
    })
    .eq("report_id", reportId)
    .select()
    .single();
}

export async function getListingReportCounts() {
  return await supabase
    .from("listing_reports")
    .select("listing_id, status")
    .eq("status", "pending");
}

export async function reactivateListing(listingId) {
  return updateListing(listingId, { status: "active" });
}

// ─────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────
 
/**
Fetch all notifications for a user (newest first, max 50).
Only selects the columns that actually exist in the table.
*/
export async function getNotificationsForUser(userId) {
  return await supabase
    .from("notifications")
    .select("notification_id, type, channel, message, created_at")
    .eq("user_id", userId)
    .neq("status", "cleared")
    .order("created_at", { ascending: false });
}
 
/**
 Mark one notification as read.
*/
export async function markNotificationCleared(notificationId) {
  return await supabase
    .from("notifications")
    .update({ status: "cleared" })
    .eq("notification_id", notificationId);
}
 
/**
Create a notification.
Only inserts columns that exist: user_id, type, channel, status.
type values:
  "message" | "booking_request" | "booking_accepted" |
  "booking_declined" | "booking_cancelled" | "booking_update"
Errors are logged but never thrown — notifications are non-critical.
*/
export async function createNotification({ userId, type, channel = "in_app", message = null, status = "sent" }) {
  return await supabase
    .from("notifications")
    .insert([{ user_id: userId, type, channel, message, status }]);
}
// PAYMENTS
// ───────────────────────────────────────────────__

/** Create a payment log row once a booking is accepted/created. */
export async function createPayment({
  booking_id,
  customer_id,
  student_id,
  amount,
  status = "Unpaid",
  provider = "manual",
  provider_payment_id = null,
}) {
  return await supabase
    .from("payments")
    .insert({
      booking_id,
      customer_id,
      student_id,
      amount,
      status,
      provider,
      provider_payment_id,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
}

/** Get all payments for a client. */
export async function getPaymentsByClient(customerId) {
  return await supabase
    .from("payments")
    .select(`
      payment_id,
      booking_id,
      customer_id,
      student_id,
      amount,
      status,
      provider,
      created_at,
      bookings(
        bookings_id,
        listing_id,
        listings(
          title
        )
      ),
      customer:users!payments_customer_id_fkey(
        user_id,
        first_name,
        last_name
      ),
      student:users!payments_student_id_fkey(
        user_id,
        first_name,
        last_name
      )
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
}

/** Get all payments for a student. */
export async function getPaymentsForStudent(studentId) {
  return await supabase
    .from("payments")
    .select(`
      payment_id,
      booking_id,
      customer_id,
      student_id,
      amount,
      status,
      provider,
      created_at,
      bookings(
        bookings_id,
        listing_id,
        listings(
          title
        )
      ),
      customer:users!payments_customer_id_fkey(
        user_id,
        first_name,
        last_name
      ),
      student:users!payments_student_id_fkey(
        user_id,
        first_name,
        last_name
      )
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
}

/** Update just the payment status. */
export async function updatePaymentStatus(paymentId, status) {
  return await supabase
    .from("payments")
    .update({ status })
    .eq("payment_id", paymentId)
    .select()
    .single(); }