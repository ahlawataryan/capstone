import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import Button from "react-bootstrap/Button";
import ButtonGroup from 'react-bootstrap/ButtonGroup';

export default function Navbar() {
  const { user, logout } = useAuth0();

  const handleLogout = () =>
    logout({
      logoutParams: { returnTo: window.location.origin },
    });

  return (
    <nav className="navbar navbar-expand-lg bg-light border-bottom">
      <div className="container-fluid px-4">

        <span className="navbar-brand fw-bold btn">
          UWM TradeSkill App
        </span>

        <div className="d-flex gap-2 ms-3">
            <ButtonGroup className="mb-2">
                <Button className="btn" as={Link} to="/AdminDashboard">Home</Button>
                <Button className="btn" as={Link} to="/Jobs">Jobs</Button>
                <Button className="btn" as={Link} to="/Messages">Messages</Button>
                <Button className="btn" >Payments</Button>
            </ButtonGroup>
        </div>

        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="small text-muted">
            {user?.email || user?.name}
          </span>

          <Button className="btn btn-sm" as={Link} to="/Profile">Profile</Button>

          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

      </div>
    </nav>
  );
}