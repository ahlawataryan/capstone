import { Card } from "react-bootstrap";
import RatingStars from "./RatingStars";

export default function ReviewList({ reviews = [] }) {
  if (!reviews.length) {
    return (
      <Card>
        <Card.Body>No reviews yet.</Card.Body>
      </Card>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      {reviews.map((r) => (
        <Card key={r.id}>
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <strong>Client:</strong> {r.client_email}
              </div>
              <div>
                <RatingStars value={r.rating} />
              </div>
            </div>

            {r.review_text && <div className="mb-2">{r.review_text}</div>}

            <div style={{ fontSize: "0.9em", opacity: 0.7 }}>
              {new Date(r.created_at).toLocaleString()}
            </div>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}