import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Navbar from "../components/Navbar";
import {
  getUserByEmail,
  getAllSkills,
  getSkillsForStudent,
  getActiveListings,
  getListingsByStudent,
  createListing,
  addSkillToListing,
  deactivateListing,
  reactivateListing,
  hardDeleteListingFull,
  createBookingRequest,
  createConversation,
  sendMessage,
  doesConvoExist,
  getUserById,
  getReviewSummary,
  createListingReport,
  createUserReport,
} from "../services/supabaseapi";

/*
Component to create and display listings.
Additionally initiates booking requests and sends initial messages.
Also supports reporting scam listings or scam profiles.
*/

export default function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth0();

  const [dbUser, setDbUser] = useState(null);
  const [role, setRole] = useState(null);
  const [listings, setListings] = useState([]);
  const [skills, setSkills] = useState([]);
  const [studentSkills, setStudentSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [hiring, setHiring] = useState(false);
  const [hireModal, setHireModal] = useState(null);
  const [hireForm, setHireForm] = useState({
    price: "",
    startDate: "",
    endDate: "",
  });

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [messageModal, setMessageModal] = useState(null);
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [myListings, setMyListings] = useState([]);
  const [deactivateModal, setDeactivateModal] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const [reactivateModal, setReactivateModal] = useState(null);
  const [reactivating, setReactivating] = useState(false);

  const [skillFilter, setSkillFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [maxPay, setMaxPay] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [pricingType, setPricingType] = useState("");
  const [applied, setApplied] = useState({
    skill: "",
    location: "",
    maxPay: "",
    date: "",
    pricingType: "",
  });

  const [profileModal, setProfileModal] = useState(null);

  const [newListing, setNewListing] = useState({
    title: "",
    description: "",
    location_text: "",
    pricing_type: "hourly",
    price_amount: "",
    selectedSkills: [],
  });

  const [reportModal, setReportModal] = useState(null);
  const [reportType, setReportType] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user?.email) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: userData, error: userError } = await getUserByEmail(user.email);
      if (userError) throw userError;

      setDbUser(userData);
      setRole(userData.role);

      await fetchListings();

      const { data: skillData, error: skillError } = await getAllSkills();
      if (skillError) throw skillError;
      setSkills(skillData || []);

      if (userData.role === "student") {
        const { data: studentSkillData, error: studentSkillError } =
          await getSkillsForStudent(userData.user_id);

        if (!studentSkillError && studentSkillData) {
          const profileSkills = studentSkillData.map((row) => row.skills).filter(Boolean);
          setStudentSkills(profileSkills);
        }

        const { data: myListingData } = await getListingsByStudent(userData.user_id);
        setMyListings(myListingData || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to fetch job data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchListings = async () => {
    const { data, error } = await getActiveListings();
    if (error) throw error;
    setListings(data || []);
  };

  const handleApplyFilters = () => {
    setApplied({
      skill: skillFilter,
      location: locationFilter,
      maxPay,
      date: dateFilter,
      pricingType,
    });
  };

  const handleClearFilters = () => {
    setSkillFilter("");
    setLocationFilter("");
    setMaxPay("");
    setDateFilter("");
    setPricingType("");
    setApplied({
      skill: "",
      location: "",
      maxPay: "",
      date: "",
      pricingType: "",
    });
  };

  const filtered = listings.filter((listing) => {
    if (role === "student" && dbUser && listing.student_id === dbUser.user_id) {
      return false;
    }

    const listingSkillNames =
      listing.listingsskills?.map((ls) => ls.skills?.name) ?? [];

    if (applied.skill && !listingSkillNames.includes(applied.skill)) return false;

    if (
      applied.location &&
      !listing.location_text?.toLowerCase().includes(applied.location.toLowerCase())
    ) {
      return false;
    }

    if (applied.maxPay && listing.price_amount > Number(applied.maxPay)) {
      return false;
    }

    if (applied.date && new Date(listing.created_at) < new Date(applied.date)) {
      return false;
    }

    if (applied.pricingType && listing.pricing_type !== applied.pricingType) {
      return false;
    }

    return true;
  });

  const openHireModal = (listing) => {
    setHireModal(listing);
    setHireForm({
      price: listing.price_amount ?? "",
      startDate: "",
      endDate: "",
    });
  };

  const sendHireRequest = async () => {
    setError("");
    setSuccess("");

    if (!dbUser || !hireModal) return;

    if (!hireForm.startDate || !hireForm.endDate) {
      setError("Please set a start and end date.");
      return;
    }

    if (new Date(hireForm.endDate) < new Date(hireForm.startDate)) {
      setError("End date must be after start date.");
      return;
    }

    setHiring(true);

    try {
      const { error } = await createBookingRequest({
        customer_id: dbUser.user_id,
        listing_id: hireModal.listing_id,
        requested_start_at: new Date(hireForm.startDate).toISOString(),
        requested_end_at: new Date(hireForm.endDate).toISOString(),
        note: JSON.stringify({ agreed_price: Number(hireForm.price) }),
      });

      if (error) throw error;

      const { data: currentConvos } = await doesConvoExist(
        dbUser.user_id,
        hireModal.student_id
      );

      if (currentConvos == null || currentConvos.length === 0) {
        const { error: convoError } = await createConversation({
          initiatorUserId: dbUser.user_id,
          recipientUserId: hireModal.student_id,
        });

        if (convoError) throw convoError;

        setSuccess(
          "Hire request sent! Initiated a conversation in the Messaging tab."
        );
      } else {
        setSuccess("Hire request sent!");
      }

      setHireModal(null);
    } catch (err) {
      console.error("Failed to hire:", err);
      setError("Failed to send hire request.");
    } finally {
      setHiring(false);
    }
  };

  const openMessageModal = (listing) => {
    setMessageModal(listing);
    setMessageBody(
      `Hi, I'm interested in your listing: "${listing.title}". Can we discuss further?`
    );
  };

  const sendMessageToListing = async () => {
    setError("");
    setSuccess("");

    if (!dbUser || !messageModal) return;

    const recipientId = messageModal.users?.user_id;
    if (!recipientId) {
      setError("Cannot message: listing has no associated user.");
      return;
    }

    setSendingMessage(true);

    try {
      const { data: convo, error: convoError } = await createConversation({
        initiatorUserId: dbUser.user_id,
        recipientUserId: recipientId,
      });
      if (convoError) throw convoError;

      const { error: msgError } = await sendMessage({
        conversationId: convo.conversation_id,
        senderUserId: dbUser.user_id,
        body: messageBody.trim(),
      });
      if (msgError) throw msgError;

      setSuccess("Message sent!");
      setMessageModal(null);
      setMessageBody("");
    } catch (err) {
      console.error("Failed to message:", err);
      setError("Failed to send message.");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteListing = async () => {
    setError("");
    setSuccess("");

    if (!deleteModal) return;
    setDeleting(true);

    try {
      const { error } = await hardDeleteListingFull(deleteModal.listing_id);
      if (error) throw error;

      setSuccess(`"${deleteModal.title}" has been permanently deleted.`);
      setDeleteModal(null);
      await fetchListings();
    } catch (err) {
      console.error("Failed to delete listing:", err);
      setError("Failed to delete listing.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeactivateListing = async () => {
    setError("");
    setSuccess("");

    if (!deactivateModal) return;
    setDeactivating(true);

    try {
      const { error } = await deactivateListing(deactivateModal.listing_id);
      if (error) throw error;

      setSuccess(
        `"${deactivateModal.title}" has been deactivated and removed from the job board.`
      );
      setDeactivateModal(null);

      const { data: myListingData } = await getListingsByStudent(dbUser.user_id);
      setMyListings(myListingData || []);
      await fetchListings();
    } catch (err) {
      console.error("Failed to deactivate listing:", err);
      setError("Failed to deactivate listing.");
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivateListing = async () => {
    setError("");
    setSuccess("");

    if (!reactivateModal) return;
    setReactivating(true);

    try {
      const { error } = await reactivateListing(reactivateModal.listing_id);
      if (error) throw error;

      setSuccess(
        `"${reactivateModal.title}" has been reactivated and added back to the job board.`
      );
      setReactivateModal(null);

      const { data: myListingData } = await getListingsByStudent(dbUser.user_id);
      setMyListings(myListingData || []);
      await fetchListings();
    } catch (err) {
      console.error("Failed to reactivate listing:", err);
      setError("Failed to reactivate listing.");
    } finally {
      setReactivating(false);
    }
  };

  const handleCreateListing = async () => {
    setError("");
    setSuccess("");

    if (!newListing.title || !newListing.price_amount) {
      alert("Please fill in title and price.");
      setError("Please fill in title and price.");
      return;
    }

    try {
      const { data: created, error: listingError } = await createListing({
        student_id: dbUser.user_id,
        title: newListing.title,
        description: newListing.description || null,
        location_text: newListing.location_text || null,
        pricing_type: newListing.pricing_type,
        price_amount: Number(newListing.price_amount),
      });

      if (listingError) throw listingError;

      for (const skill_id of newListing.selectedSkills) {
        await addSkillToListing(created.listing_id, skill_id);
      }

      setSuccess("Listing created.");
      setShowCreateModal(false);
      setNewListing({
        title: "",
        description: "",
        location_text: "",
        pricing_type: "hourly",
        price_amount: "",
        selectedSkills: [],
      });
      await fetchListings();

      const { data: myListingData } = await getListingsByStudent(dbUser.user_id);
      setMyListings(myListingData || []);
    } catch (err) {
      console.error("Failed to create listing:", err);
      setError("Failed to create listing.");
    }
  };

  const toggleSkill = (skill_id) => {
    setNewListing((prev) => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skill_id)
        ? prev.selectedSkills.filter((id) => id !== skill_id)
        : [...prev.selectedSkills, skill_id],
    }));
  };

  const openProfileModal = async (listing) => {
    try {
      const studentId = listing.student_id;
      if (!studentId) return;

      const [
        { data: userData, error: userError },
        { data: summaryData, error: summaryError },
        { data: listingsData, error: listingsError },
      ] = await Promise.all([
        getUserById(studentId),
        getReviewSummary(studentId),
        getListingsByStudent(studentId),
      ]);

      if (userError) throw userError;
      if (summaryError) throw summaryError;
      if (listingsError) throw listingsError;

      const activeListings = (listingsData || []).filter(
        (item) => item.status === "active"
      );

      setProfileModal({
        ...userData,
        reviewSummary: summaryData,
        activeListings,
      });
    } catch (err) {
      console.error("Failed to load profile modal:", err);
      setError("Failed to load profile.");
    }
  };

  const openListingReportModal = (listing) => {
    setError("");
    setSuccess("");

    if (dbUser && listing?.student_id === dbUser.user_id) {
      setError("You cannot report your own listing.");
      return;
    }

    setReportType("listing");
    setReportModal(listing);
    setReportReason("");
    setReportDetails("");
  };

  const openUserReportModal = (profileUser) => {
    setError("");
    setSuccess("");

    if (dbUser && profileUser?.user_id === dbUser.user_id) {
      setError("You cannot report your own profile.");
      return;
    }

    setReportType("user");
    setReportModal(profileUser);
    setReportReason("");
    setReportDetails("");
  };

  const submitReport = async () => {
    setError("");
    setSuccess("");

    if (!dbUser) {
      setError("You must be logged in to submit a report.");
      return;
    }

    if (!reportModal || !reportType) {
      setError("No report target selected.");
      return;
    }

    if (!reportReason) {
      setError("Please choose a reason for the report.");
      return;
    }

    try {
      setReporting(true);

      if (reportType === "listing") {
        const { error } = await createListingReport({
          listingId: reportModal.listing_id,
          reportedByUserId: dbUser.user_id,
          listingOwnerUserId: reportModal.student_id,
          reason: reportReason,
          details: reportDetails.trim() || null,
        });

        if (error) throw error;
      }

      if (reportType === "user") {
        const { error } = await createUserReport({
          reportedUserId: reportModal.user_id,
          reportedByUserId: dbUser.user_id,
          reason: reportReason,
          details: reportDetails.trim() || null,
        });

        if (error) throw error;
      }

      setSuccess("Report submitted successfully. Admin will review it.");
      setReportModal(null);
      setReportType("");
      setReportReason("");
      setReportDetails("");
    } catch (err) {
      console.error("Failed to submit report:", err);
      setError("Failed to submit report.");
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container py-4">Loading...</div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Available Jobs</h2>
          {role === "student" && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              + Post a Job
            </button>
          )}
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title mb-3">Filter Jobs</h5>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Skill</label>
                <select
                  className="form-select"
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value)}
                >
                  <option value="">All Skills</option>
                  {skills.map((s) => (
                    <option key={s.skill_id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Location</label>
                <input
                  className="form-control"
                  placeholder="e.g. Milwaukee"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Maximum Pay ($)</label>
                <input
                  className="form-control"
                  type="number"
                  placeholder="e.g. 50"
                  value={maxPay}
                  onChange={(e) => setMaxPay(e.target.value)}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Posted After</label>
                <input
                  className="form-control"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Pricing Type</label>
                <select
                  className="form-select"
                  value={pricingType}
                  onChange={(e) => setPricingType(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="hourly">Hourly</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>

              <div className="col-md-4 d-flex align-items-end gap-2">
                <button className="btn btn-primary w-100" onClick={handleApplyFilters}>
                  Apply Filters
                </button>
                <button
                  className="btn btn-outline-secondary w-100"
                  onClick={handleClearFilters}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {role === "student" && myListings.length > 0 && (
          <div className="mb-5">
            <h4 className="fw-bold mb-3">My Listings</h4>
            <div className="row g-3">
              {myListings.map((listing) => (
                <div className="col-md-6" key={listing.listing_id}>
                  <div
                    className={`card h-100 shadow-sm border-2 ${
                      listing.status === "inactive"
                        ? "border-secondary opacity-75"
                        : "border-primary"
                    }`}
                  >
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <h5 className="card-title mb-0">{listing.title}</h5>
                      <span
                        className={`badge ${
                          listing.status === "active" ? "bg-success" : "bg-secondary"
                        }`}
                      >
                        {listing.status}
                      </span>
                    </div>

                    <div className="card-body">
                      <p className="text-muted small mb-2">
                        {listing.description || "No description."}
                      </p>
                      <p className="mb-1 small">
                        <strong>Price:</strong> ${listing.price_amount} /{" "}
                        {listing.pricing_type}
                      </p>
                      {listing.location_text && (
                        <p className="mb-0 small">
                          <strong>Location:</strong> {listing.location_text}
                        </p>
                      )}
                    </div>

                    <div className="card-footer d-flex gap-2">
                      {listing.status === "active" && (
                        <button
                          className="btn btn-warning btn-sm flex-fill"
                          onClick={() => setDeactivateModal(listing)}
                        >
                          Deactivate
                        </button>
                      )}

                      {listing.status === "inactive" && (
                        <button
                          className="btn btn-success btn-sm flex-fill"
                          onClick={() => setReactivateModal(listing)}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <hr className="my-4" />
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-muted">No jobs match your filters.</p>
        ) : (
          <div className="row g-3">
            {filtered.map((listing) => (
              <div className="col-md-6" key={listing.listing_id}>
                <div className="card h-100 shadow-sm">
                  <div className="card-header">
                    <h5 className="card-title mb-0">{listing.title}</h5>
                  </div>

                  <div className="card-body">
                    <p className="text-muted small mb-1">
                      Posted by{" "}
                      <button
                        type="button"
                        className="btn btn-link p-0 align-baseline"
                        onClick={() => openProfileModal(listing)}
                      >
                        {listing.users?.first_name} {listing.users?.last_name}
                      </button>
                    </p>

                    {listing.description && (
                      <p className="small mb-2">{listing.description}</p>
                    )}

                    <p className="text-muted mb-1">
                      Location: {listing.location_text || "Remote"}
                    </p>

                    <p className="text-muted mb-1">
                      Rate: ${listing.price_amount} ({listing.pricing_type})
                    </p>

                    <p className="text-muted mb-2">
                      Date: {new Date(listing.created_at).toLocaleDateString()}
                    </p>

                    <div>
                      {listing.listingsskills?.map((ls) => (
                        <span
                          key={ls.skills?.skill_id}
                          className="badge bg-primary me-1"
                        >
                          {ls.skills?.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="card-footer d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-primary btn-sm flex-fill"
                      onClick={() => openHireModal(listing)}
                    >
                      Hire
                    </button>

                    <button
                      className="btn btn-outline-secondary btn-sm flex-fill"
                      onClick={() => openMessageModal(listing)}
                    >
                      Message
                    </button>

                    <button
                      className="btn btn-outline-primary btn-sm flex-fill"
                      onClick={() => navigate(`/reviews?studentId=${listing.student_id}`)}
                    >
                      Reviews
                    </button>

                    <button
                      className="btn btn-outline-danger btn-sm flex-fill"
                      onClick={() => openListingReportModal(listing)}
                    >
                      Report Listing
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Post a New Job</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowCreateModal(false)}
                  />
                </div>

                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Title *</label>
                      <input
                        className="form-control"
                        placeholder="e.g. Pet Sitter Available for Weekend Gigs"
                        value={newListing.title}
                        onChange={(e) =>
                          setNewListing((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Describe what you can do..."
                        value={newListing.description}
                        onChange={(e) =>
                          setNewListing((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Location</label>
                      <input
                        className="form-control"
                        placeholder="e.g. Milwaukee, WI or Remote"
                        value={newListing.location_text}
                        onChange={(e) =>
                          setNewListing((prev) => ({
                            ...prev,
                            location_text: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">Pricing Type *</label>
                      <select
                        className="form-select"
                        value={newListing.pricing_type}
                        onChange={(e) =>
                          setNewListing((prev) => ({
                            ...prev,
                            pricing_type: e.target.value,
                          }))
                        }
                      >
                        <option value="hourly">Hourly</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">Price ($) *</label>
                      <input
                        className="form-control"
                        type="number"
                        placeholder="e.g. 25"
                        value={newListing.price_amount}
                        onChange={(e) =>
                          setNewListing((prev) => ({
                            ...prev,
                            price_amount: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Your Skills</label>
                      {studentSkills.length === 0 ? (
                        <p className="text-muted small mb-0">
                          You haven't added any skills to your profile yet.{" "}
                          <a href="/profile">Go to your profile</a> to add skills first.
                        </p>
                      ) : (
                        <div className="d-flex flex-wrap gap-2">
                          {studentSkills.map((s) => (
                            <div key={s.skill_id}>
                              <input
                                type="checkbox"
                                className="btn-check"
                                id={`skill-${s.skill_id}`}
                                checked={newListing.selectedSkills.includes(
                                  s.skill_id
                                )}
                                onChange={() => toggleSkill(s.skill_id)}
                              />
                              <label
                                className={`btn btn-sm ${
                                  newListing.selectedSkills.includes(s.skill_id)
                                    ? "btn-primary"
                                    : "btn-outline-primary"
                                }`}
                                htmlFor={`skill-${s.skill_id}`}
                              >
                                {s.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleCreateListing}>
                    Post Job
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {messageModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Message {messageModal.users?.first_name}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setMessageModal(null)}
                  />
                </div>

                <div className="modal-body">
                  <p className="text-muted small mb-2">
                    Re: <strong>{messageModal.title}</strong>
                  </p>
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                  />
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setMessageModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!messageBody.trim() || sendingMessage}
                    onClick={sendMessageToListing}
                  >
                    {sendingMessage ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {hireModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Hire — {hireModal.title}</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setHireModal(null)}
                  />
                </div>

                <div className="modal-body">
                  <p className="text-muted small mb-3">
                    Posted by{" "}
                    <button
                      type="button"
                      className="btn btn-link p-0 align-baseline"
                      onClick={() => setProfileModal(hireModal.users)}
                    >
                      {hireModal.users?.first_name} {hireModal.users?.last_name}
                    </button>{" "}
                    · Listed at ${hireModal.price_amount} ({hireModal.pricing_type})
                  </p>

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Agreed Price ($) *</label>
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        value={hireForm.price}
                        onChange={(e) =>
                          setHireForm((prev) => ({
                            ...prev,
                            price: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Start Date *</label>
                      <input
                        className="form-control"
                        type="date"
                        value={hireForm.startDate}
                        onChange={(e) =>
                          setHireForm((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">End Date *</label>
                      <input
                        className="form-control"
                        type="date"
                        value={hireForm.endDate}
                        min={hireForm.startDate || undefined}
                        onChange={(e) =>
                          setHireForm((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setHireModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={
                      !hireForm.price ||
                      !hireForm.startDate ||
                      !hireForm.endDate ||
                      hiring
                    }
                    onClick={sendHireRequest}
                  >
                    {hiring ? "Sending..." : "Send Hire Request"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {profileModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {profileModal.first_name} {profileModal.last_name}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setProfileModal(null)}
                  />
                </div>

                <div className="modal-body">
                  <div className="text-center mb-3">
                    <div
                      className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto mb-2"
                      style={{ width: "60px", height: "60px", fontSize: "1.5rem" }}
                    >
                      {profileModal?.first_name?.[0]}
                    </div>

                    <h5 className="mb-0">
                      {profileModal?.first_name} {profileModal?.last_name}
                    </h5>

                    <p className="text-muted small mb-0">{profileModal?.email}</p>
                  </div>

                  <div className="mb-3">
                    <h6 className="fw-bold">About</h6>
                    <p className="text-muted mb-0">
                      {profileModal?.bio || "No bio provided yet."}
                    </p>
                  </div>

                  <div className="mb-3">
                    <h6 className="fw-bold">Contact</h6>
                    <p className="mb-1">
                      <i className="bi bi-envelope me-2 text-primary"></i>
                      {profileModal?.email}
                    </p>

                    <p className="mb-0">
                      <i className="bi bi-telephone me-2 text-primary"></i>
                      {profileModal?.phone || "Not added"}
                    </p>
                  </div>

                  {profileModal?.skills && profileModal.skills.length > 0 && (
                    <div>
                      <h6 className="fw-bold">Skills</h6>
                      <div className="d-flex flex-wrap gap-1">
                        {profileModal.skills.map((s) => (
                          <span key={s.skill_id} className="badge bg-primary">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <h6 className="fw-bold mb-2">Reviews</h6>
                    <p className="mb-0">
                      Average Rating: {profileModal?.reviewSummary?.avg || 0} / 5
                    </p>
                    <p className="mb-0">
                      Total Reviews: {profileModal?.reviewSummary?.count || 0}
                    </p>

                    <div className="mt-2">
                      <button
                        className="btn btn-link p-0 text-decoration-none"
                        onClick={() =>
                          navigate(`/reviews?studentId=${profileModal.user_id}`)
                        }
                      >
                        View all reviews →
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h6 className="fw-bold">Active Listings</h6>

                    {profileModal?.activeListings?.length > 0 ? (
                      <div className="d-flex flex-column gap-2">
                        {profileModal.activeListings.map((item) => (
                          <button
                            key={item.listing_id}
                            type="button"
                            className="border rounded p-2 text-start bg-white w-100"
                            onClick={() => {
                              setProfileModal(null);
                              openHireModal({
                                ...item,
                                users: profileModal,
                              });
                            }}
                          >
                            <div className="fw-semibold">{item.title}</div>
                            <div className="small text-muted">
                              ${item.price_amount} ({item.pricing_type}) ·{" "}
                              {item.location_text || "Remote"}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted mb-0">No active listings right now.</p>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-danger me-auto"
                    onClick={() => openUserReportModal(profileModal)}
                  >
                    Report User
                  </button>

                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setProfileModal(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {reportModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-danger">
                    {reportType === "listing" ? "Report Listing" : "Report User"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setReportModal(null);
                      setReportType("");
                      setReportReason("");
                      setReportDetails("");
                    }}
                  />
                </div>

                <div className="modal-body">
                  <p className="text-muted small">
                    {reportType === "listing" ? (
                      <>
                        You are reporting: <strong>{reportModal.title}</strong>
                      </>
                    ) : (
                      <>
                        You are reporting:{" "}
                        <strong>
                          {reportModal.first_name} {reportModal.last_name}
                        </strong>
                      </>
                    )}
                  </p>

                  <div className="mb-3">
                    <label className="form-label">Reason *</label>
                    <select
                      className="form-select"
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                    >
                      <option value="">Select a reason</option>
                      <option value="scam_or_fraud">Scam or fraud</option>
                      <option value="fake_profile">Fake profile</option>
                      <option value="misleading_listing">Misleading listing</option>
                      <option value="spam">Spam</option>
                      <option value="harassment">Harassment</option>
                      <option value="inappropriate_content">
                        Inappropriate content
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="mb-0">
                    <label className="form-label">Details</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="Add more information for the admin review team"
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setReportModal(null);
                      setReportType("");
                      setReportReason("");
                      setReportDetails("");
                    }}
                    disabled={reporting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={submitReport}
                    disabled={!reportReason || reporting}
                  >
                    {reporting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {deleteModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-danger">
                    Permanently Delete Listing
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setDeleteModal(null)}
                  />
                </div>

                <div className="modal-body">
                  <p>
                    Are you sure you want to permanently delete{" "}
                    <strong>&ldquo;{deleteModal.title}&rdquo;</strong>?
                  </p>
                  <p className="text-muted small mb-0">
                    This will remove the listing and all related data from the database.
                    <strong className="text-danger"> This cannot be undone.</strong>
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setDeleteModal(null)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={deleting}
                    onClick={handleDeleteListing}
                  >
                    {deleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {deactivateModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-warning">Deactivate Listing</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setDeactivateModal(null)}
                  />
                </div>

                <div className="modal-body">
                  <p>
                    Are you sure you want to deactivate{" "}
                    <strong>&ldquo;{deactivateModal.title}&rdquo;</strong>?
                  </p>
                  <p className="text-muted small mb-0">
                    This listing will be hidden from the job board. It stays in the
                    database and can be reactivated later.
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setDeactivateModal(null)}
                    disabled={deactivating}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-warning"
                    disabled={deactivating}
                    onClick={handleDeactivateListing}
                  >
                    {deactivating ? "Deactivating..." : "Deactivate Listing"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {reactivateModal && (
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-success">Reactivate Listing</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setReactivateModal(null)}
                  />
                </div>

                <div className="modal-body">
                  <p>
                    Are you sure you want to reactivate{" "}
                    <strong>&ldquo;{reactivateModal.title}&rdquo;</strong>?
                  </p>
                  <p className="text-muted small mb-0">
                    This listing will become visible on the job board again.
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setReactivateModal(null)}
                    disabled={reactivating}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-success"
                    disabled={reactivating}
                    onClick={handleReactivateListing}
                  >
                    {reactivating ? "Reactivating..." : "Reactivate Listing"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}