import { useEffect, useMemo, useState } from "react";
import { Card, Form, Button, Alert, Row, Col } from "react-bootstrap";
import { upsertReview } from "../../services/supabaseapi";

export default function ReviewForm({
  reviewerUserId,
  revieweeUserId,
  reviews = [],
  onSubmitted,
}) {
  const existingReview = useMemo(() => {
    return reviews.find((r) => Number(r.reviewer_user_id) === Number(reviewerUserId)) || null;
  }, [reviews, reviewerUserId]);

  const [rating, setRating] = useState(5);
  const [workQualityRating, setWorkQualityRating] = useState(5);
  const [communicationRating, setCommunicationRating] = useState(5);
  const [professionalismRating, setProfessionalismRating] = useState(5);
  const [reliabilityRating, setReliabilityRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating ?? 5);
      setWorkQualityRating(existingReview.work_quality_rating ?? 5);
      setCommunicationRating(existingReview.communication_rating ?? 5);
      setProfessionalismRating(existingReview.professionalism_rating ?? 5);
      setReliabilityRating(existingReview.reliability_rating ?? 5);
      setComment(existingReview.comment ?? "");
    } else {
      setRating(5);
      setWorkQualityRating(5);
      setCommunicationRating(5);
      setProfessionalismRating(5);
      setReliabilityRating(5);
      setComment("");
    }
  }, [existingReview]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!reviewerUserId) return setErr("Missing reviewer id.");
    if (!revieweeUserId) return setErr("Missing student id.");

    setSaving(true);

    const overall =
      Math.round(
        ((Number(workQualityRating) +
          Number(communicationRating) +
          Number(professionalismRating) +
          Number(reliabilityRating)) /
          4) *
          10
      ) / 10;

    const { error } = await upsertReview({
      reviewId: existingReview?.review_id || null,
      bookingId: existingReview?.booking_id || null,
      reviewerUserId,
      revieweeUserId,
      rating: overall,
      workQualityRating: Number(workQualityRating),
      communicationRating: Number(communicationRating),
      professionalismRating: Number(professionalismRating),
      reliabilityRating: Number(reliabilityRating),
      comment,
    });

    setSaving(false);

    if (error) {
      setErr(error.message || "Failed to submit review.");
      return;
    }

    setRating(overall);
    setMsg(existingReview ? "Review updated successfully." : "Review saved successfully.");

    if (onSubmitted) onSubmitted();
  };

  const renderSelect = (label, value, setter) => (
    <Form.Group as={Col} md={6} className="mb-3">
      <Form.Label>{label}</Form.Label>
      <Form.Select value={value} onChange={(e) => setter(Number(e.target.value))}>
        <option value="5">5 - Excellent</option>
        <option value="4">4 - Good</option>
        <option value="3">3 - Okay</option>
        <option value="2">2 - Poor</option>
        <option value="1">1 - Bad</option>
      </Form.Select>
    </Form.Group>
  );

  return (
    <Card className="mb-4">
      <Card.Header>{existingReview ? "Edit Your Review" : "Leave a Review"}</Card.Header>
      <Card.Body>
        {err && <Alert variant="danger">{err}</Alert>}
        {msg && <Alert variant="success">{msg}</Alert>}

        <Form onSubmit={submit}>
          <Row>
            {renderSelect("Work Quality", workQualityRating, setWorkQualityRating)}
            {renderSelect("Communication", communicationRating, setCommunicationRating)}
            {renderSelect("Professionalism", professionalismRating, setProfessionalismRating)}
            {renderSelect("Reliability", reliabilityRating, setReliabilityRating)}
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Overall Rating</Form.Label>
            <Form.Control value={rating} disabled readOnly />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Review</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe the student's work quality, professionalism, communication, and reliability."
            />
          </Form.Group>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : existingReview ? "Update Review" : "Submit Review"}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}