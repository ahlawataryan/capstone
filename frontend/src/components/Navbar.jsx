import { useAuth0 } from "@auth0/auth0-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Button,
  Container,
  Nav,
  Navbar as BsNavbar,
} from "react-bootstrap";
import { getUserByEmail } from "../services/supabaseapi";

export default function Navbar() {
  const { user, logout } = useAuth0();
  const [dbUser, setDbUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (!user?.email) return;

    const loadClientData = async () => {
      const { data: userData, error: userError } = await getUserByEmail(user.email);

      if (userError) {
        console.error("Error loading user:", userError);
        return;
      }

      setDbUser(userData);
    };

    loadClientData();
  }, [user]);

  const handleLogout = () =>
    logout({
      logoutParams: { returnTo: window.location.origin },
    });

  const isActive = (path) => location.pathname === path;

  const getHomePath = () => {
    if (dbUser?.role === "student") return "/student/dashboard";
    if (dbUser?.role === "client") return "/client/dashboard";
    if (dbUser?.role === "admin") return "/AdminDashboard";
    return "/";
  };

  return (
    <BsNavbar bg="light" expand="lg" className="border-bottom shadow-sm py-2">
      <Container fluid className="px-4">
        <BsNavbar.Brand as={Link} to={getHomePath()} className="fw-bold fs-4">
          TaskFinder
        </BsNavbar.Brand>

        <BsNavbar.Toggle aria-controls="main-navbar" />

        <BsNavbar.Collapse id="main-navbar">
          <Nav className="ms-auto align-items-lg-center gap-lg-2">
            <Nav.Link
              as={Link}
              to={getHomePath()}
              className={isActive(getHomePath()) ? "fw-bold text-primary" : "fw-semibold"}
            >
              Home
            </Nav.Link>

            <Nav.Link
              as={Link}
              to="/Jobs"
              className={isActive("/Jobs") ? "fw-bold text-primary" : "fw-semibold"}
            >
              Jobs
            </Nav.Link>

            <Nav.Link
              as={Link}
              to="/Messages"
              className={isActive("/Messages") ? "fw-bold text-primary" : "fw-semibold"}
            >
              Messages
            </Nav.Link>

            <Nav.Link
              as={Link}
              to="/Bookings"
              className={isActive("/Bookings") ? "fw-bold text-primary" : "fw-semibold"}
            >
              Bookings
            </Nav.Link>

            <Nav.Link
              as={Link}
              to="/Payment"
              className={isActive("/Payment") ? "fw-bold text-primary" : "fw-semibold"}
            >
              Payment
            </Nav.Link>
          </Nav>

          <div className="d-flex align-items-center gap-2 ms-lg-3 mt-3 mt-lg-0">
            <span className="small text-muted d-none d-md-inline">
              {dbUser
                ? `${dbUser.first_name || ""} ${dbUser.last_name || ""}`.trim() || dbUser.email
                : user?.email || "Client"}
            </span>

            <Button as={Link} to="/profile" variant="primary" size="sm">
              Profile
            </Button>

            <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}