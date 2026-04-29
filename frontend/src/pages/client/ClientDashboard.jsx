import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import RatingStars from "../../components/Reviews/RatingStars";
import {
  getUserByEmail,
} from "../../services/supabaseapi";
import Carousel from 'react-bootstrap/Carousel';
import slide1 from '../../assets/slide1.jpg';
import slide2 from '../../assets/slide2.jpg';

export default function ClientDashboard() {
  const { user } = useAuth0();
  const [dbUser, setDbUser] = useState(null);

  useEffect(() => {
    if (!user?.email) return;

    const loadClientData = async () => {
    const { data: userData, error: userError } = await getUserByEmail(user.email);

    if (userError || !userData) {
      console.error("Failed to load client data:", userError);
      return;
    }

    setDbUser(userData);
  };

  loadClientData();
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
                  : user?.email || "Client"}
              </h1>
              <p className="text-muted mb-0">
                Find student talent, manage payments, and keep your hiring process organized in one place.
              </p>
            </div>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-md-6 col-xl-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title">Browse Students</h5>
                <p className="card-text text-muted">
                  Search student talent by skills, experience, rate, and availability.
                </p>
                <Link to="/jobs" className="btn btn-sm btn-primary">
                  Browse Students
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
                  Send payments securely and review your transaction history.
                </p>
                <Link to="/payment" className="btn btn-sm btn-primary">
                  Go to Payments
                </Link>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-xl-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title">Reviews</h5>
                <p className="card-text text-muted">
                  Open student reviews directly from the Jobs page.
                </p>
                <Link to="/jobs" className="btn btn-sm btn-primary">
                  Go to Jobs
                </Link>
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
                        {dbUser?.bio || "No bio added yet."}
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
                        {dbUser?.bio && dbUser?.phone
                          ? "Your profile looks complete."
                          : "Complete your bio and phone number to strengthen your profile."}
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
                <h5 className="mb-3">Quick Actions</h5>
                <div className="d-grid gap-2">
                  <Link to="/jobs" className="btn btn-outline-primary">
                    Browse Students
                  </Link>
                  <Link to="/payment" className="btn btn-outline-primary">
                    Make a Payment
                  </Link>
                  <Link to="/jobs" className="btn btn-outline-primary">
                    Review from Jobs
                  </Link>
                  <Link to="/profile" className="btn btn-outline-primary">
                    Update Profile
                  </Link>
                </div>
              </div>
            </div>

            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h5 className="mb-3">Recent Activity</h5>
                <ul className="list-group list-group-flush">
                  <li className="list-group-item px-0 text-muted">No recent hires yet.</li>
                  <li className="list-group-item px-0 text-muted">No recent reviews yet.</li>
                  <li className="list-group-item px-0 text-muted">No recent payment activity yet.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}