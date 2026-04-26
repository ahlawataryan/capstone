import { supabase } from "../supabaseconfig";

/*
Centralized wrapper functions for Supabase calls.
*/

const nowIso = () => new Date().toISOString();

function isFutureOrCurrent(dateValue) {
  if (!dateValue) return false;
  return new Date(dateValue).getTime() >= Date.now();
}

// ─────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────

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
      delete_request_status,
      delete_request_review_note,
      account_status,
      report_count
    `)
    .order("first_name");
}

export async function getUserByEmail(email) {
  return await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
}

export async function getUserById(userId) {
  return await supabase
    .from("users")
    .select("*")
    .eq("user_id", userId)
    .single();
}

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

export async function insertUser({ email, role, first_name, last_name, phone, bio }) {
  return await supabase
    .from("users")
    .insert({ email, role, first_name, last_name, phone, bio })
    .select()
    .single();
}

export async function updateUserProfile(userId, fields) {
  return await supabase
    .from("users")
    .update({ ...fields, updated_at: nowIso() })
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

export async function deactivateUser(userId) {
  return await supabase
    .from("users")
    .update({
      is_active: false,
      account_status: "deleted",
      updated_at: nowIso(),
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
      updated_at: nowIso(),
    })
    .eq("user_id", userId)
    .select()
    .single();
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
      updated_at: nowIso(),
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
      updated_at: nowIso(),
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

export async function updateIcon(fileurl, file) {
  return await supabase.storage
    .from("icons")
    .upload(fileurl, file, { upsert: true, contentType: "image/jpeg" });
}

export function getIcon(fileurl) {
  return supabase.storage.from("icons").getPublicUrl(fileurl);
}

export async function setUserIcon(email, fileurl) {
  return await supabase
    .from("users")
    .update({ icon_url: fileurl })
    .eq("email", email)
    .select();
}

export async function deleteIcon(fileurl) {
  return await supabase.storage.from("icons").remove([fileurl]);
}

// ─────────────────────────────────────────────────
// SKILLS
// ─────────────────────────────────────────────────

export async function getAllSkills() {
  return await supabase
    .from("skills")
    .select("skill_id, name")
    .eq("is_active", true)
    .order("name");
}

export async function getSkillsForStudent(studentId) {
  return await supabase
    .from("studentskills")
    .select("proficiency, interest, skills(skill_id, name)")
    .eq("student_id", studentId);
}

export async function upsertStudentSkill(studentId, skillId, proficiency, interest) {
  return await supabase
    .from("studentskills")
    .upsert(
      { student_id: studentId, skill_id: skillId, proficiency, interest },
      { onConflict: "student_id,skill_id" }
    );
}

export async function removeStudentSkill(studentId, skillId) {
  return await supabase
    .from("studentskills")
    .delete()
    .eq("student_id", studentId)
    .eq("skill_id", skillId);
}

export async function getStudentsBySkillName(skillName) {
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
// EXPIRED BOOKING / REQUEST SYNC
// ─────────────────────────────────────────────────

export async function syncExpiredBookingRequests() {
  return await supabase
    .from("bookingrequests")
    .update({
      status: "expired",
      updated_at: nowIso(),
    })
    .eq("status", "pending")
    .lt("requested_end_at", nowIso())
    .select();
}

export async function syncExpiredBookings() {
  return await supabase
    .from("bookings")
    .update({
      status: "completed",
      updated_at: nowIso(),
    })
    .eq("status", "confirmed")
    .lt("end_at", nowIso())
    .select();
}

export async function syncExpiredBookingData() {
  const { error: requestError } = await syncExpiredBookingRequests();
  if (requestError) return { data: null, error: requestError };

  const { error: bookingError } = await syncExpiredBookings();
  if (bookingError) return { data: null, error: bookingError };

  return { data: true, error: null };
}

// ─────────────────────────────────────────────────
// LISTINGS
// ─────────────────────────────────────────────────

export async function getActiveListings() {
  await syncExpiredBookingData();

  const { data, error } = await supabase
    .from("listings")
    .select(`
      listing_id,
      title,
      description,
      status,
      location_text,
      pricing_type,
      price_amount,
      created_at,
      student_id,
      users!listings_student_id_fkey(
        user_id,
        first_name,
        last_name,
        email,
        phone,
        bio,
        icon_url
      ),
      listingsskills(
        skills(skill_id, name)
      ),
      bookings(
        bookings_id,
        status,
        start_at,
        end_at
      )
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error };

  const cleanedListings = (data || []).filter((listing) => {
    const hasActiveConfirmedBooking = (listing.bookings || []).some(
      (booking) =>
        booking.status === "confirmed" && isFutureOrCurrent(booking.end_at)
    );

    return !hasActiveConfirmedBooking;
  });

  return { data: cleanedListings, error: null };
}

export async function getListingsByStudent(studentId) {
  await syncExpiredBookingData();

  return await supabase
    .from("listings")
    .select(`
      listing_id,
      student_id,
      title,
      description,
      status,
      location_text,
      pricing_type,
      price_amount,
      created_at,
      updated_at,
      listingsskills(
        skills(skill_id, name)
      ),
      bookings(
        bookings_id,
        customer_id,
        status,
        start_at,
        end_at,
        agreed_price_amount
      )
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
}

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

export async function createListing({
  student_id,
  title,
  description,
  status = "active",
  location_text,
  pricing_type,
  price_amount,
}) {
  return await supabase
    .from("listings")
    .insert({
      student_id,
      title,
      description,
      status,
      location_text,
      pricing_type,
      price_amount,
    })
    .select()
    .single();
}

export async function updateListing(listingId, fields) {
  return await supabase
    .from("listings")
    .update({ ...fields, updated_at: nowIso() })
    .eq("listing_id", listingId)
    .select()
    .single();
}

export async function deactivateListing(listingId) {
  return updateListing(listingId, { status: "inactive" });
}

export async function reactivateListing(listingId) {
  return updateListing(listingId, { status: "active" });
}

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

export async function hardDeleteListingFull(listingId) {
  return await supabase.rpc("hard_delete_listing_full", {
    target_listing_id: listingId,
  });
}

export async function addSkillToListing(listingId, skillId) {
  return await supabase
    .from("listingsskills")
    .upsert(
      { listing_id: listingId, skill_id: skillId },
      { onConflict: "listing_id,skill_id" }
    );
}

export async function removeSkillFromListing(listingId, skillId) {
  return await supabase
    .from("listingsskills")
    .delete()
    .eq("listing_id", listingId)
    .eq("skill_id", skillId);
}

export async function getListingsBySkill(skillId) {
  return await supabase
    .from("listingsskills")
    .select(`
      listings(
        listing_id,
        title,
        description,
        status,
        location_text,
        pricing_type,
        price_amount,
        created_at,
        users(user_id, first_name, last_name, email)
      )
    `)
    .eq("skill_id", skillId)
    .eq("listings.status", "active");
}

// ─────────────────────────────────────────────────
// AVAILABILITY
// ─────────────────────────────────────────────────

export async function getAvailabilityForStudent(studentId) {
  return await supabase
    .from("availabilityslots")
    .select("*")
    .eq("student_id", studentId)
    .order("start_at");
}

export async function addAvailabilitySlot(studentId, startAt, endAt, status = "open") {
  return await supabase
    .from("availabilityslots")
    .insert({ student_id: studentId, start_at: startAt, end_at: endAt, status })
    .select()
    .single();
}

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

export async function createBookingRequest({
  customer_id,
  listing_id,
  requested_start_at,
  requested_end_at,
  note,
}) {
  await syncExpiredBookingData();

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(`
      listing_id,
      status,
      bookings(
        bookings_id,
        status,
        end_at
      )
    `)
    .eq("listing_id", listing_id)
    .single();

  if (listingError) {
    return { data: null, error: listingError };
  }

  if (!listing || listing.status !== "active") {
    return {
      data: null,
      error: { message: "This listing is no longer available." },
    };
  }

  const hasActiveConfirmedBooking = (listing.bookings || []).some(
    (booking) =>
      booking.status === "confirmed" && isFutureOrCurrent(booking.end_at)
  );

  if (hasActiveConfirmedBooking) {
    return {
      data: null,
      error: { message: "This listing is already booked." },
    };
  }

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

export async function getBookingRequestsByClient(customerId) {
  await syncExpiredBookingData();

  return await supabase
    .from("bookingrequests")
    .select(`
      *,
      listings(
        title,
        price_amount,
        users(first_name, last_name)
      )
    `)
    .eq("customer_id", customerId)
    .not("status", "eq", "expired")
    .order("created_at", { ascending: false });
}

export async function getBookingRequestsForStudent(studentId) {
  await syncExpiredBookingData();

  return await supabase
    .from("bookingrequests")
    .select(`
      *,
      listings!inner(
        listing_id,
        title,
        student_id
      ),
      users(
        first_name,
        last_name,
        email
      )
    `)
    .eq("listings.student_id", studentId)
    .not("status", "eq", "expired")
    .order("created_at", { ascending: false });
}

export async function updateBookingRequestStatus(requestId, status) {
  return await supabase
    .from("bookingrequests")
    .update({ status, updated_at: nowIso() })
    .eq("request_id", requestId)
    .select()
    .single();
}

// ─────────────────────────────────────────────────
// BOOKINGS
// ─────────────────────────────────────────────────

export async function createBooking({
  request_id,
  customer_id,
  listing_id,
  start_at,
  end_at,
  agreed_price_amount,
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

export async function getBookingsByClient(customerId) {
  await syncExpiredBookingData();

  return await supabase
    .from("bookings")
    .select(`
      *,
      listings(
        listing_id,
        student_id,
        title,
        description,
        location_text,
        pricing_type,
        price_amount,
        users!listings_student_id_fkey(
          user_id,
          first_name,
          last_name,
          email
        )
      )
    `)
    .eq("customer_id", customerId)
    .order("start_at");
}


export async function getBookingsForStudent(studentId) {
  await syncExpiredBookingData();

  return await supabase
    .from("bookings")
    .select(`
      *,
      listings!inner(
        listing_id,
        title,
        student_id
      ),
      users(
        first_name,
        last_name,
        email
      )
    `)
    .eq("listings.student_id", studentId)
    .order("start_at");
}

export async function getActiveBookingListingsForClient(customerId) {
  await syncExpiredBookingData();

  return await supabase
    .from("bookings")
    .select(`
      bookings_id,
      request_id,
      customer_id,
      listing_id,
      start_at,
      end_at,
      status,
      agreed_price_amount,
      listings(
        listing_id,
        title,
        description,
        location_text,
        pricing_type,
        price_amount,
        listingsskills(
          skills(skill_id, name)
        ),
        users!listings_student_id_fkey(
          user_id,
          first_name,
          last_name,
          email
        )
      )
    `)
    .eq("customer_id", customerId)
    .eq("status", "confirmed")
    .gte("end_at", nowIso())
    .order("start_at", { ascending: true });
}

export async function updateBookingStatus(bookingId, status) {
  return await supabase
    .from("bookings")
    .update({ status, updated_at: nowIso() })
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

export async function getAcceptedBookingsForClientAndStudent(clientUserId, studentUserId) {
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
    .eq("listings.student_id", studentUserId)
    .in("status", ["confirmed", "completed"])
    .order("bookings_id", { ascending: false });
}

// ─────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────

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

export async function deleteReview(reviewId) {
  return await supabase
    .from("reviews")
    .delete()
    .eq("review_id", reviewId);
}

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
// REPORTS
// ─────────────────────────────────────────────────

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
  return await supabase
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
        pricing_type
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
      admin_note,
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

// ─────────────────────────────────────────────────
// MESSAGES / CONVERSATIONS
// ─────────────────────────────────────────────────

export async function createConversation({ initiatorUserId, recipientUserId }) {
  return await supabase
    .from("conversations")
    .insert({
      request_id: null,
      booking_id: null,
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
      sent_at: nowIso(),
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
      conversation_id,
      created_at,
      initiator_user_id,
      recipient_user_id,
      initiator:users!conversations_initiator_user_id_fkey(user_id, first_name, last_name),
      recipient:users!conversations_recipient_user_id_fkey(user_id, first_name, last_name),
      messages(message_id, body, sent_at, sender_user_id)
    `)
    .or(`initiator_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .order("created_at", { ascending: false });
}

export async function doesConvoExist(senderId, receiverId) {
  return await supabase
    .from("conversations")
    .select("recipient_user_id, initiator_user_id")
    .or(
      `and(initiator_user_id.eq.${senderId},recipient_user_id.eq.${receiverId}),and(recipient_user_id.eq.${senderId},initiator_user_id.eq.${receiverId})`
    );
}

// ─────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────

export async function createNotification({ userId, type, message }) {
  return await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      channel: "in_app",
      status: "unread",
      message,
      created_at: nowIso(),
    })
    .select()
    .single();
}

export async function getNotificationsForUser(userId) {
  return await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function markNotificationAsRead(notificationId) {
  return await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("notification_id", notificationId)
    .select()
    .single();
}

export async function markAllNotificationsAsRead(userId) {
  return await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("user_id", userId)
    .eq("status", "unread");
}

export async function markNotificationCleared(notificationId) {
  return await supabase
    .from("notifications")
    .update({ status: "cleared" })
    .eq("notification_id", notificationId)
    .select()
    .single();
}

// ─────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────

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
      created_at: nowIso(),
    })
    .select()
    .single();
}

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

export async function updatePaymentStatus(paymentId, status) {
  return await supabase
    .from("payments")
    .update({ status })
    .eq("payment_id", paymentId)
    .select()
    .single();
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