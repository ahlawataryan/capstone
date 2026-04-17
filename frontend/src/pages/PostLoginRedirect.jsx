import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getUserByEmail } from "../services/supabaseapi";
import {
  getSignupRole,
  setRoleForEmail,
} from "../providers/roleStore";

export default function PostLoginRedirect() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth0();

  const ADMIN_EMAILS = ["test@uwm.edu"];

  useEffect(() => {
    const redirectUser = async () => {
      if (isLoading || !isAuthenticated) return;

      const email = (user?.email || "").toLowerCase();

      if (!email) {
        logout({ logoutParams: { returnTo: window.location.origin } });
        return;
      }

      // Admin bypass
      if (ADMIN_EMAILS.includes(email)) {
        navigate("/admin", { replace: true });
        return;
      }

      try {
        const { data, error } = await getUserByEmail(email);

        // Existing user found in DB
        if (!error && data) {
          // Block deleted/inactive users
          if (data.is_active === false || data.account_status === "deleted") {
            alert("Your account has been deleted or disabled.");
            logout({ logoutParams: { returnTo: window.location.origin } });
            return;
          }

          setRoleForEmail(email, data.role);

          if (data.role === "student") {
            navigate("/student/dashboard", { replace: true });
            return;
          }

          if (data.role === "client") {
            navigate("/client/dashboard", { replace: true });
            return;
          }

          if (data.role === "admin") {
            navigate("/admin", { replace: true });
            return;
          }
        }

        // No DB row found:
        // only allow this if it is truly a signup flow
        const signupRole = getSignupRole();

        if (signupRole === "student" || signupRole === "client") {
          setRoleForEmail(email, signupRole);

          if (signupRole === "student") {
            navigate("/student/dashboard", { replace: true });
            return;
          }

          navigate("/client/dashboard", { replace: true });
          return;
        }

        // If not signup and no user exists, do not allow access
        alert("Your account does not exist or has been removed.");
        logout({ logoutParams: { returnTo: window.location.origin } });
      } catch (err) {
        console.error("Failed to fetch role from database:", err);
        alert("There was a problem checking your account.");
        logout({ logoutParams: { returnTo: window.location.origin } });
      }
    };

    redirectUser();
  }, [isLoading, isAuthenticated, user, navigate, logout]);

  return <div className="container py-4">Redirecting...</div>;
}