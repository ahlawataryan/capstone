import { useAuth0 } from "@auth0/auth0-react";
import { Link, useLocation } from "react-router-dom";
import {
  Button,
  Container,
  Nav,
  Navbar as BsNavbar,
} from "react-bootstrap";
import { getRoleForEmail } from "../providers/roleStore";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { user, logout } = useAuth0();
  const location = useLocation();

  const role = getRoleForEmail(user?.email);

  const getHomePath = () => {
    if (role === "student") return "/student/dashboard";
    if (role === "client") return "/client/dashboard";
    if (role === "admin") return "/admin";
    return "/post-login";
  };

  const handleLogout = () =>
    logout({
      logoutParams: { returnTo: window.location.origin },
    });

  const isActive = (path) => location.pathname === path;

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
              to="/AdminDashboard"
              className={isActive("/AdminDashboard") ? "fw-bold text-primary" : "fw-semibold"}
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
              {user?.email || user?.name}
            </span>

            <NotificationBell />

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