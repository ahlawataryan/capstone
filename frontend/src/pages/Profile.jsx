import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";
import {
  getActiveSkills,
  getProfileSkills,
  saveProfileSkills,
} from "../services/skillService";
import {
  getUserByEmail,
  updateUserProfile,
  updateIcon,
  getIcon,
  setUserIcon,
  getReviewSummary,
  getListingsByStudent,
  requestAccountDeletion,
} from "../services/supabaseapi";

const BIO_MAX = 1024;
const DELETE_REASON_MAX = 500;

function formatPhone(digits) {
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function Profile() {
  const { user } = useAuth0();
  const [allSkills, setAllSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    bio: "",
  });

  const [previewUrl, setPreviewUrl] = useState("");
  const [iconFile, setIconFile] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);

  const [reviewSummary, setReviewSummary] = useState({
    avg: 0,
    count: 0,
    workQualityAvg: 0,
    communicationAvg: 0,
    professionalismAvg: 0,
    reliabilityAvg: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });

  const [userListings, setUserListings] = useState([]);

  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false);
  const [deleteRequestReason, setDeleteRequestReason] = useState("");
  const [deleteRequestLoading, setDeleteRequestLoading] = useState(false);

  const handleSkillToggle = (skillId) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email) return;

      try {
        const { data: profileData, error } = await getUserByEmail(user.email);
        if (error) throw error;

        setProfile(profileData);

        const skillsData = await getActiveSkills();
        setAllSkills(skillsData);

        if (profileData) {
          setForm({
            name: `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim(),
            email: profileData.email || user.email || "",
            phone: profileData.phone || "",
            bio: profileData.bio || "",
          });

          if (profileData?.user_id) {
            const [
              { data: summaryData, error: summaryError },
              { data: listingsData, error: listingsError },
            ] = await Promise.all([
              getReviewSummary(profileData.user_id),
              getListingsByStudent(profileData.user_id),
            ]);

            if (!summaryError && summaryData) {
              setReviewSummary(summaryData);
            }

            if (!listingsError && listingsData) {
              const activeOnly = listingsData.filter(
                (listing) => listing.status === "active"
              );
              setUserListings(activeOnly);
            }
          }

          const userSkillIds = await getProfileSkills(profileData.user_id);
          setSelectedSkills(userSkillIds);
        } else {
          setForm({
            name: user.name || "",
            email: user.email || "",
            phone: "",
            bio: "",
          });
        }

        if (profileData?.icon_url) {
          const { data: iconData } = getIcon(profileData.icon_url);
          setPreviewUrl(iconData.publicUrl || "");
        } else {
          setPreviewUrl("");
        }
      } catch (err) {
        console.error(err);
        setError("Could not load profile.");
      }
    };

    loadProfile();
  }, [user]);

  const handleChange = (e) => {
    setError("");
    setSuccess("");

    const { name, value } = e.target;

    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, phone: digitsOnly }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    setError("");
    setSuccess("");

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }

    setIconFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!user?.email) {
      setError("No authenticated user found.");
      return;
    }

    if (form.phone && form.phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }

    try {
      const nameParts = form.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ");

      const { data: updatedProfile, error: updateError } = await updateUserProfile(
        profile.user_id,
        {
          first_name: firstName,
          last_name: lastName,
          phone: form.phone,
          bio: form.bio,
        }
      );

      if (updateError) throw updateError;
      if (!updatedProfile) {
        setError("Could not save profile changes.");
        return;
      }

      const userUrl = `${profile.user_id}.jpg`;

      if (iconFile) {
        const { error: updateIconError } = await updateIcon(userUrl, iconFile);
        if (updateIconError) throw updateIconError;

        const { error: setUserIconError } = await setUserIcon(profile.email, userUrl);
        if (setUserIconError) throw setUserIconError;
      }

      await saveProfileSkills(updatedProfile.user_id, selectedSkills);

      setProfile(updatedProfile);
      setSuccess("Profile changes saved successfully.");
    } catch (err) {
      console.error(err);
      setError("Could not save profile changes.");
    }
  };

  const handleRequestAccountDeletion = async () => {
    setError("");
    setSuccess("");

    if (!profile?.user_id) {
      setError("Could not find your account.");
      return;
    }

    if (!deleteRequestReason.trim()) {
      setError("Please provide a reason for deleting your account.");
      return;
    }

    try {
      setDeleteRequestLoading(true);

      const { error } = await requestAccountDeletion(
        profile.user_id,
        deleteRequestReason.trim()
      );

      if (error) throw error;

      setProfile((prev) => ({
        ...prev,
        delete_requested: true,
        delete_request_reason: deleteRequestReason.trim(),
        delete_request_status: "pending",
        delete_request_review_note: null,
        account_status: "deletion_requested",
      }));

      setSuccess("Your account deletion request has been submitted for admin review.");
      setShowDeleteRequestModal(false);
      setDeleteRequestReason("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not submit account deletion request.");
    } finally {
      setDeleteRequestLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="container py-4">
        <h2 className="mb-4">
          My Profile ({profile?.role || "Loading..."})
        </h2>

        <div className="row g-4">
          <div className="col-lg-4">
            <div className="card shadow-sm mb-3">
              <div className="card-body text-center">
                <img
                  src={previewUrl || "https://placehold.co/140x140"}
                  alt="Profile"
                  className="rounded-circle mb-3"
                  width="140"
                  height="140"
                  style={{ objectFit: "cover" }}
                />

                <div className="mb-3 text-start">
                  <label className="form-label fw-semibold">
                    Upload Profile Photo
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  <div className="form-text">PNG or JPG, max 5MB.</div>
                </div>
              </div>
            </div>

            {profile?.role === "student" && (
              <div className="card shadow-sm">
                <div className="card-body">
                  <h5 className="card-title mb-3">Skills</h5>

                  <div className="d-flex flex-wrap gap-2">
                    {allSkills.map((skill) => {
                      const isSelected = selectedSkills.includes(skill.skill_id);

                      return (
                        <button
                          key={skill.skill_id}
                          type="button"
                          className={`btn ${
                            isSelected ? "btn-primary" : "btn-outline-primary"
                          }`}
                          onClick={() => handleSkillToggle(skill.skill_id)}
                        >
                          {skill.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="col-lg-8">
            {profile?.role === "student" && (
              <div className="card shadow-sm mb-3">
                <div className="card-body">
                  <h5 className="card-title mb-3">Profile Summary</h5>
                  <p className="mb-1">
                    <strong>Average Rating:</strong>{" "}
                    {reviewSummary.count === 0 ? "No reviews yet" : `${reviewSummary.avg} / 5`}
                  </p>
                  <p className="mb-1">
                    <strong>Total Reviews:</strong> {reviewSummary.count}
                  </p>
                  <p className="mb-2">
                    <strong>Active Listings:</strong> {userListings.length}
                  </p>

                  <div className="mb-4">
                    <Link
                      to={`/reviews?studentId=${profile?.user_id}`}
                      className="text-decoration-none"
                    >
                      View all reviews →
                    </Link>
                  </div>

                  {userListings.length > 0 && (
                    <>
                      <h6 className="mb-2">Current Listings</h6>
                      {userListings.map((listing) => (
                        <div
                          key={listing.listing_id}
                          className="border rounded p-2 mb-2"
                        >
                          <div className="fw-semibold">{listing.title}</div>
                          <div className="small text-muted">
                            ${listing.price_amount} ({listing.pricing_type}) ·{" "}
                            {listing.location_text || "Remote"}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <h5 className="card-title mb-3">Edit Profile Details</h5>

                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                {profile?.delete_request_status === "pending" && (
                  <div className="alert alert-warning">
                    Your account deletion request is currently under admin review.
                  </div>
                )}

                {profile?.delete_request_status === "denied" && (
                  <div className="alert alert-danger">
                    {profile?.delete_request_review_note ||
                      "Your account deletion request was denied or closed by the admin."}
                  </div>
                )}

                {profile?.delete_request_status === "approved" && (
                  <div className="alert alert-success">
                    {profile?.delete_request_review_note ||
                      "Your account deletion request was approved."}
                  </div>
                )}

                <form onSubmit={handleSave}>
                  <div className="row g-20">
                    <div className="col-md-6">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        className="form-control"
                        value={form.name}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        name="email"
                        className="form-control"
                        value={form.email}
                        disabled
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        name="phone"
                        className="form-control"
                        placeholder="(414) 555-0123"
                        value={formatPhone(form.phone)}
                        onChange={handleChange}
                        maxLength={14}
                      />
                      <div className="form-text">10-digit US phone number</div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Bio</label>
                      <textarea
                        name="bio"
                        className="form-control"
                        rows="4"
                        placeholder="Tell us about yourself"
                        value={form.bio}
                        onChange={handleChange}
                        maxLength={BIO_MAX}
                      />
                      <div
                        className={`form-text text-end ${
                          form.bio.length >= BIO_MAX ? "text-danger" : ""
                        }`}
                      >
                        {form.bio.length} / {BIO_MAX} characters
                      </div>
                    </div>

                    <div className="col-12 mt-2">
                      <button type="submit" className="btn btn-primary px-4">
                        Save Changes
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="card shadow-sm border-danger">
              <div className="card-body">
                <h5 className="card-title text-danger mb-3">Danger Zone</h5>
                <p className="text-muted mb-3">
                  You can request account deletion here. Your request will be sent
                  to the admin for review before the account is removed.
                </p>

                {profile?.delete_requested || profile?.delete_request_status === "pending" ? (
                  <div className="alert alert-warning mb-0">
                    You have already submitted an account deletion request.
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => {
                      setError("");
                      setSuccess("");
                      setShowDeleteRequestModal(true);
                    }}
                  >
                    Request Account Deletion
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-20"></div>
        </div>
      </div>

      {showDeleteRequestModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title text-danger">
                  Confirm Account Deletion Request
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowDeleteRequestModal(false);
                    setDeleteRequestReason("");
                  }}
                  disabled={deleteRequestLoading}
                />
              </div>

              <div className="modal-body">
                <p className="mb-3">
                  Are you sure you want to request account deletion? This action
                  will be sent to the admin for review.
                </p>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Reason for deletion
                  </label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Please tell us why you want to delete your account"
                    value={deleteRequestReason}
                    onChange={(e) =>
                      setDeleteRequestReason(
                        e.target.value.slice(0, DELETE_REASON_MAX)
                      )
                    }
                    maxLength={DELETE_REASON_MAX}
                  />
                  <div className="form-text text-end">
                    {deleteRequestReason.length} / {DELETE_REASON_MAX}
                  </div>
                </div>

                <div className="alert alert-warning mb-0">
                  Please confirm carefully so this is not submitted by accident.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDeleteRequestModal(false);
                    setDeleteRequestReason("");
                  }}
                  disabled={deleteRequestLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleRequestAccountDeletion}
                  disabled={deleteRequestLoading}
                >
                  {deleteRequestLoading ? "Submitting..." : "Yes, Request Deletion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}