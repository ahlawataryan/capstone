import { useState } from "react";
import { Card, Button, Modal, Alert, Row, Col } from "react-bootstrap";
import RatingStars from "./RatingStars";
import { deleteReview, upsertReview } from "../../services/supabaseapi";

/*
The reviews page is weird. There are two ways to edit reviews, and they both work and look different.
One looks better with alerts, and the other looks better on the page.
*/

export default function ReviewList({
  reviews = [],
  currentUserId,
  currentUserRole,
  onChanged,
}) {
  const [editingReview, setEditingReview] = useState(null);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editForm, setEditForm] = useState({
    comment: "",
    work_quality_rating: 5,
    communication_rating: 5,
    professionalism_rating: 5,
    reliability_rating: 5,
  });

  const openEdit = (review) => {
    setEditingReview(review);
    setEditError("");
    setEditForm({
      comment: review.comment || "",
      work_quality_rating: review.work_quality_rating ?? 5,
      communication_rating: review.communication_rating ?? 5,
      professionalism_rating: review.professionalism_rating ?? 5,
      reliability_rating: review.reliability_rating ?? 5,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReview) return;

    setSavingEdit(true);
    setEditError("");

    const overall =
      Math.round(
        ((Number(editForm.work_quality_rating) +
          Number(editForm.communication_rating) +
          Number(editForm.professionalism_rating) +
          Number(editForm.reliability_rating)) /
          4) *
          10
      ) / 10;

    const { error } = await upsertReview({
      reviewId: editingReview.review_id,
      bookingId: editingReview.booking_id || null,
      reviewerUserId: editingReview.reviewer_user_id,
      revieweeUserId: editingReview.reviewee_user_id,
      rating: overall,
      workQualityRating: Number(editForm.work_quality_rating),
      communicationRating: Number(editForm.communication_rating),
      professionalismRating: Number(editForm.professionalism_rating),
      reliabilityRating: Number(editForm.reliability_rating),
      comment: editForm.comment,
    });

    setSavingEdit(false);

    if (error) {
      setEditError(error.message || "Failed to update review.");
      return;
    }

    setEditingReview(null);
    if (onChanged) onChanged();
  };

  const handleDelete = async (reviewId) => {
    setError("");
    setSuccess("");

    const confirmed = window.confirm("Are you sure you want to delete this review?");
    if (!confirmed) return;

    setDeletingReviewId(reviewId);

    const { error } = await deleteReview(reviewId);

    setDeletingReviewId(null);

    if (error) {
      setError("Failed to delete review");
      return;
    }

    setSuccess("Review deleted successfully.");
    if (onChanged) onChanged();
  };

  const canManageReview = (review) =>
    currentUserRole === "client" &&
    Number(review.reviewer_user_id) === Number(currentUserId);

  if (!reviews.length) {
    return (
      <Card>
        <Card.Body>No reviews yet.</Card.Body>
      </Card>
    );
  }

  const renderSelect = (label, field) => (
    <Col md={6} className="mb-3">
      <label className="form-label">{label}</label>
      <select
        className="form-select"
        value={editForm[field]}
        onChange={(e) =>
          setEditForm((prev) => ({
            ...prev,
            [field]: Number(e.target.value),
          }))
        }
      >
        <option value="5">5 - Excellent</option>
        <option value="4">4 - Good</option>
        <option value="3">3 - Okay</option>
        <option value="2">2 - Poor</option>
        <option value="1">1 - Bad</option>
      </select>
    </Col>
  );

  return (
    <>
      <div className="d-flex flex-column gap-3">
        {reviews.map((r) => (
          <Card key={r.review_id}>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <strong>Client:</strong>{" "}
                  {r.users
                    ? `${r.users.first_name || ""} ${r.users.last_name || ""}`.trim()
                    : "Anonymous"}
                </div>

                <div className="text-end">
                  <RatingStars value={r.rating} />
                </div>
              </div>

              <Row className="mb-2 small">
                <Col md={6}>
                  <div>
                    <strong>Work Quality:</strong> <RatingStars value={r.work_quality_rating} />
                  </div>
                  <div>
                    <strong>Communication:</strong> <RatingStars value={r.communication_rating} />
                  </div>
                </Col>
                <Col md={6}>
                  <div>
                    <strong>Professionalism:</strong>{" "}
                    <RatingStars value={r.professionalism_rating} />
                  </div>
                  <div>
                    <strong>Reliability:</strong> <RatingStars value={r.reliability_rating} />
                  </div>
                </Col>
              </Row>

              {r.comment && <div className="mb-2">{r.comment}</div>}

              <div className="d-flex justify-content-between align-items-center">
                <div style={{ fontSize: "0.9em", opacity: 0.7 }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>

                {canManageReview(r) && (
                  <div className="d-flex gap-2">
                    <Button variant="outline-primary" size="sm" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      disabled={deletingReviewId === r.review_id}
                      onClick={() => handleDelete(r.review_id)}
                    >
                      {deletingReviewId === r.review_id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      <Modal show={!!editingReview} onHide={() => setEditingReview(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Review</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError && <Alert variant="danger">{editError}</Alert>}
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <Row>
            {renderSelect("Work Quality", "work_quality_rating")}
            {renderSelect("Communication", "communication_rating")}
            {renderSelect("Professionalism", "professionalism_rating")}
            {renderSelect("Reliability", "reliability_rating")}
          </Row>

          <div className="mb-3">
            <label className="form-label">Comment</label>
            <textarea
              className="form-control"
              rows={4}
              value={editForm.comment}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  comment: e.target.value,
                }))
              }
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditingReview(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={savingEdit} onClick={handleSaveEdit}>
            {savingEdit ? "Saving..." : "Save Changes"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}