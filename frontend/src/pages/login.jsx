import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
/*
Login page
Handles sign up role selection
Uses PostLoginRedirect to figure out where to send the user
Auth0 redirects automatically
Basic account information uses localStorage. Functions can be found in roleStore.js
*/
export default function Login() {
  const { loginWithRedirect, isLoading, error } = useAuth0();

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [role, setRole] = useState(""); // "student" | "client"

  const handleLogin = () => {
    loginWithRedirect(); // normal login, no role selection
  };

  const openSignup = () => {
    setRole("");//Hook variable. Used to remember for account creation in PostLoginRedirect
    setShowRoleModal(true);
  };

  const continueSignup = async () => {
    if (!role) return;

    // store role locally for later use
    localStorage.setItem("signup_role", role);//Honestly can't tell if this is redundant. I don't think so because of continueSignup

    await loginWithRedirect({
      authorizationParams: { screen_hint: "signup" },
    });
  };


  if (isLoading) return <div className="container py-4">Loading...</div>;

  return (
    <div className="container py-5">
      {error && <div className="alert alert-danger">{error.message}</div>}

      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body p-4 text-center">
              <h2 className="mb-2">UWM TradeSkill App</h2>
              <p className="text-muted mb-4">Sign in or create an account to continue.</p>

              <div className="d-grid gap-2">
                <button className="btn btn-primary" onClick={handleLogin}>
                  Login
                </button>

                <button className="btn btn-outline-primary" onClick={openSignup}>
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signup Role Modal */}
      {showRoleModal && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Choose account type</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowRoleModal(false)}
                />
              </div>

              <div className="modal-body">
                <p className="text-muted">
                  Are you signing up as a student offering services or a client/customer hiring services?{" "}
                  <span title="Your account type cannot be changed after sign-up." style={{ cursor: "help" }}>?</span>
                </p>

                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="role"
                    id="student"
                    checked={role === "student"}
                    onChange={() => setRole("student")}
                  />
                  <label className="form-check-label" htmlFor="student">
                    Student (offer services){" "}
                    <span title="Choose this if you are a UW-Milwaukee student who wants to post job listings and get paid for your skills." style={{ cursor: "help" }}>?</span>
                  </label>
                </div>

                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="role"
                    id="client"
                    checked={role === "client"}
                    onChange={() => setRole("client")}
                  />
                  <label className="form-check-label" htmlFor="client">
                    Client / Customer (hire services){" "}
                    <span title="Choose this if you are a resident of the greater Milwaukee area looking for jobs done." style={{ cursor: "help" }}>?</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setShowRoleModal(false)}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  disabled={!role}
                  onClick={continueSignup}
                >
                  Continue to Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}