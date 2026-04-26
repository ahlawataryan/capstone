import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import RatingStars from "../../components/Reviews/RatingStars";
import {
  getUserByEmail,
  getReviewsForStudent,
  getReviewSummary,
} from "../../services/supabaseapi";
import Carousel from 'react-bootstrap/Carousel';
import slide1 from '../../assets/slide1.jpg';
import slide2 from '../../assets/slide2.jpg';

/*
Student dashboard. The most complicated one
Includes snapshots of reviews and links to other views
*/

export default function StudentDashboard() {
  const { user } = useAuth0();
  const [profile, setProfile] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ avg: 0, count: 0 });

  useEffect(() => {
    if (!user?.email) return;

    const loadDashboardData = async () => {
      const saved = localStorage.getItem(`profile_${user.email.toLowerCase()}`);
      if (saved) {
        setProfile(JSON.parse(saved));
      }
      /*
      Get user to get other info for the dashboard
      No in app error message. May be a worthwhile change here
      */
      const { data: userData, error: userError } = await getUserByEmail(user.email);
      if (userError || !userData) {
        console.error("Failed to load user data:", userError);
        return;
      }

      setDbUser(userData);
      /*
      Get reviews for the summary
      Does not appear to have any error output
      */
      const [{ data: reviewList, error: reviewError }, { data: summaryData, error: summaryError }] =
        await Promise.all([
          getReviewsForStudent(userData.user_id),
          getReviewSummary(userData.user_id),
        ]);
        console.log("reviewList:", reviewList);

      if (!reviewError && Array.isArray(reviewList)) {
        setReviews(reviewList);
      }

      if (!summaryError && summaryData) {
        setReviewSummary(summaryData);
      }
    };

    loadDashboardData();
  }, [user]);

  return (
    <>
      <Navbar />

      <Carousel>
      <Carousel.Item>
        <img src={slide1} alt="First slide" className="d-block w-100 text-black bg-white" style={{ height: "300px", objectFit: "cover" }}/>
        <Carousel.Caption>
          <Link to="/profile" style={{ color: "white", textDecoration: "none" }}>
            <h3>Connect with real people</h3>
          </Link>
          <p>Navigate to Jobs to find and post work to connect to real people.</p>
        </Carousel.Caption>
      </Carousel.Item>
      <Carousel.Item>
            <img src={slide2} alt="Second slide" className="d-block w-100" style={{ height: "300px", objectFit: "cover" }}/>
            <Carousel.Caption>
              <Link to="/profile" style={{ color: "white", textDecoration: "none" }}>
                <h3>Find your skills</h3>
              </Link>
              <p>Navigate to profile highlight your skills and interests</p>
            </Carousel.Caption>
          </Carousel.Item>
      <Carousel.Item>
        <img src={slide1} alt="First slide" className="d-block w-100" style={{ height: "300px", objectFit: "cover" }}/>
        <Carousel.Caption>
          <Link to="/profile" style={{ color: "white", textDecoration: "none" }}>
            <h3>Gain real-world experience</h3>
          </Link>
          <p>By accepting job requests, students have access to new opportunities they've never had before</p>
        </Carousel.Caption>
      </Carousel.Item>
      </Carousel>

      <div className="container py-4">
        <div className="p-4 p-md-5 mb-4 rounded-4 bg-light border shadow-sm">
          <div className="row align-items-center g-4">
            <div className="col-md-8">
              <h1 className="display-6 fw-bold mb-2">
                Welcome back,{" "}
                {dbUser
                  ? `${dbUser.first_name || ""} ${dbUser.last_name || ""}`.trim() || dbUser.email
                  : user?.email || "Student"}
              </h1>
              <p className="text-muted mb-0">
                Manage your profile, explore job opportunities, and keep track of what clients are saying about your work.
              </p>
            </div>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-md-6 col-xl-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title">Browse Jobs</h5>
                <p className="card-text text-muted">
                  Explore opportunities that match your skills and schedule.
                </p>
                <Link to="/jobs" className="btn btn-sm btn-primary">
                  Browse Jobs
                </Link>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-xl-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title">Messages</h5>
                <p className="card-text text-muted">
                  View your previous conversations and start new ones.
                </p>
                <Link to="/messages" className="btn btn-sm btn-primary">
                  View Messages
                </Link>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-xl-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title">Payments</h5>
                <p className="card-text text-muted">
                  Stay updated on your payment activity and history.
                </p>
                <Link to="/payment" className="btn btn-sm btn-primary">
                  Open Payments
                </Link>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-xl-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title">My Rating</h5>
                <p className="card-text text-muted mb-2">
                  See how clients are rating your work and professionalism.
                </p>
                <div className="mb-2">
                  <RatingStars value={reviewSummary.avg} />
                </div>
                <div className="text-muted small">
                  {reviewSummary.count} review{reviewSummary.count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body">
                <h4 className="mb-3">Profile Snapshot</h4>

                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="p-3 rounded bg-light border h-100">
                      <h6 className="fw-bold mb-2">Bio</h6>
                      <p className="text-muted mb-0">
                        {dbUser?.bio || "No bio added yet. Update your profile to tell clients more about yourself."}
                      </p>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="p-3 rounded bg-light border h-100">
                      <h6 className="fw-bold mb-2">Contact</h6>
                      <p className="text-muted mb-1">
                        <strong>Email:</strong> {dbUser?.email || user?.email || "Not available"}
                      </p>
                      <p className="text-muted mb-0">
                        <strong>Phone:</strong> {dbUser?.phone || "Not added yet"}
                      </p>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="p-3 rounded bg-light border">
                      <h6 className="fw-bold mb-2">Profile Completion</h6>
                      <p className="text-muted mb-0">
                        {profile?.bio && profile?.phone
                          ? "Your profile looks strong and ready for clients."
                          : "Complete your bio and phone number to make your profile stronger."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-body">
                <h5 className="mb-3">Recent Reviews</h5>

                {reviews.length === 0 ? (
                  <p className="text-muted mb-0">No reviews yet.</p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {reviews.slice(0, 3).map((review) => (
                      <div key={review.review_id} className="border rounded p-3 bg-light">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <strong>
                            {review.users
                              ? `${review.users.first_name || ""} ${review.users.last_name || ""}`.trim()
                              : "Client"}
                          </strong>
                          <RatingStars value={review.rating} />
                        </div>

                        <p className="text-muted mb-1">
                          {review.comment || "No written comment provided."}
                        </p>

                        <div className="small text-muted">
                          {new Date(review.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <Link to={dbUser ? `/reviews?studentId=${dbUser.user_id}` : "/reviews"} className="btn btn-outline-primary btn-sm">
                    View All Reviews
                  </Link>
                </div>
              </div>
            </div>

            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h5 className="mb-3">Quick Actions</h5>
                <div className="d-grid gap-2">
                  <Link to="/profile" className="btn btn-outline-primary">
                    Update Profile
                  </Link>
                  <Link to="/jobs" className="btn btn-outline-primary">
                    Browse Opportunities
                  </Link>
                  <Link to="/messages" className="btn btn-outline-primary">
                    Check Messages
                  </Link>
                  <Link to="/payment" className="btn btn-outline-primary">
                    View Payments
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}