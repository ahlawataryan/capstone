import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Container, Card, Row, Col, ProgressBar } from "react-bootstrap";
import Navbar from "../components/Navbar";
import ReviewForm from "../components/Reviews/ReviewForm";
import ReviewList from "../components/Reviews/ReviewList";
import RatingStars from "../components/Reviews/RatingStars";
import {
  getUserByEmail,
  getUserById,
  getReviewsForStudent,
  getReviewSummary,
} from "../services/supabaseapi";

export default function Reviews() {
  const { user } = useAuth0();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const studentIdFromUrl = params.get("studentId");

  const [dbUser, setDbUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    avg: 0,
    count: 0,
    workQualityAvg: 0,
    communicationAvg: 0,
    professionalismAvg: 0,
    reliabilityAvg: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: currentUser, error: userError } = await getUserByEmail(user.email);
    if (userError) {
      console.error("Failed to load current user:", userError);
      setLoading(false);
      return;
    }

    setDbUser(currentUser || null);

    let resolvedStudentId = studentIdFromUrl;

    if (!resolvedStudentId && currentUser?.role === "student") {
      resolvedStudentId = currentUser.user_id;
    }

    if (!resolvedStudentId) {
      setActiveStudentId(null);
      setStudent(null);
      setReviews([]);
      setSummary({
        avg: 0,
        count: 0,
        workQualityAvg: 0,
        communicationAvg: 0,
        professionalismAvg: 0,
        reliabilityAvg: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
      setLoading(false);
      return;
    }

    setActiveStudentId(Number(resolvedStudentId));

    const { data: studentData, error: studentError } = await getUserById(resolvedStudentId);
    if (studentError) {
      console.error("Failed to load student:", studentError);
    }
    setStudent(studentData || null);

    const [
      { data: reviewList, error: reviewError },
      { data: reviewSummary, error: summaryError },
    ] = await Promise.all([
      getReviewsForStudent(resolvedStudentId),
      getReviewSummary(resolvedStudentId),
    ]);

    if (reviewError) {
      console.error("Failed to load reviews:", reviewError);
      setReviews([]);
    } else {
      setReviews(reviewList || []);
    }

    if (summaryError) {
      console.error("Failed to load review summary:", summaryError);
      setSummary({
        avg: 0,
        count: 0,
        workQualityAvg: 0,
        communicationAvg: 0,
        professionalismAvg: 0,
        reliabilityAvg: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
    } else {
      setSummary(
        reviewSummary || {
          avg: 0,
          count: 0,
          workQualityAvg: 0,
          communicationAvg: 0,
          professionalismAvg: 0,
          reliabilityAvg: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        }
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user, studentIdFromUrl]);

  const distributionPercent = (star) => {
    if (!summary.count) return 0;
    return Math.round(((summary.distribution?.[star] || 0) / summary.count) * 100);
  };

  return (
    <>
      <Navbar />
      <Container className="py-4">
        <h2 className="mb-3">Ratings & Reviews</h2>

        {loading ? (
          <div>Loading...</div>
        ) : !activeStudentId ? (
          <Card className="shadow-sm">
            <Card.Body>
              {dbUser?.role === "client"
                ? "Open a student's reviews from the Jobs page."
                : "No reviews available."}
            </Card.Body>
          </Card>
        ) : loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <Card className="mb-3 shadow-sm">
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div>
                  <div>
                    <strong>Student:</strong>{" "}
                    {student
                      ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
                      : `User #${activeStudentId}`}
                  </div>
                  <div style={{ opacity: 0.75 }}>
                    {summary.count} review{summary.count === 1 ? "" : "s"}
                  </div>
                </div>
                <div>
                  <RatingStars value={summary.avg} />
                </div>
              </Card.Body>
            </Card>

            <Card className="mb-3 shadow-sm">
              <Card.Body>
                <h5 className="mb-3">Review Analytics</h5>

                <Row className="g-3">
                  <Col md={6}>
                    <div className="mb-2">
                      <strong>Work Quality:</strong> <RatingStars value={summary.workQualityAvg} />
                    </div>
                    <div className="mb-2">
                      <strong>Communication:</strong>{" "}
                      <RatingStars value={summary.communicationAvg} />
                    </div>
                    <div className="mb-2">
                      <strong>Professionalism:</strong>{" "}
                      <RatingStars value={summary.professionalismAvg} />
                    </div>
                    <div className="mb-2">
                      <strong>Reliability:</strong> <RatingStars value={summary.reliabilityAvg} />
                    </div>
                  </Col>

                  <Col md={6}>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <div key={star} className="mb-2">
                        <div className="d-flex justify-content-between small mb-1">
                          <span>{star} star</span>
                          <span>
                            {summary.distribution?.[star] || 0} ({distributionPercent(star)}%)
                          </span>
                        </div>
                        <ProgressBar now={distributionPercent(star)} />
                      </div>
                    ))}
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {dbUser?.role === "client" && (
              <ReviewForm
                reviewerUserId={dbUser.user_id}
                revieweeUserId={activeStudentId}
                reviews={reviews}
                onSubmitted={load}
              />
            )}

            {dbUser?.role === "student" && (
              <Card className="mb-3 shadow-sm">
                <Card.Body className="text-muted">
                  These are the reviews clients have left for you.
                </Card.Body>
              </Card>
            )}

            <ReviewList
              reviews={reviews}
              currentUserId={dbUser?.user_id}
              currentUserRole={dbUser?.role}
              onChanged={load}
            />
          </>
        )}
      </Container>
    </>
  );
}