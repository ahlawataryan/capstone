import { useState } from "react";
import { Card, Form, Button, Alert } from "react-bootstrap";
import { upsertReview } from "../../api/supabaseapi.jsx";

export default function ReviewForm({ studentEmail, clientEmail, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!studentEmail) return setErr("Missing student email.");
    if (!clientEmail) return setErr("Missing client email.");

    setSaving(true);
    const { data, error } = await upsertReview({
      studentEmail,
      clientEmail,
      rating: Number(rating),
      reviewText,
    });

    setSaving(false);

    if (error) {
      setErr(error.message || "Failed to submit review.");
      return;
    }

    setMsg("Review saved!");
    setReviewText("");
    if (onSubmitted) onSubmitted(data);
  };

  return (
    <Card className="mb-3">
      <Card.Header>Submit a Review</Card.Header>
      <Card.Body>
        {err && <Alert variant="danger">{err}</Alert>}
        {msg && <Alert variant="success">{msg}</Alert>}

        <Form onSubmit={submit}>
          <Form.Group className="mb-3">
            <Form.Label>Rating</Form.Label>
            <Form.Select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Bad</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Your Review</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write your review here..."
            />
          </Form.Group>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Submit Review"}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}