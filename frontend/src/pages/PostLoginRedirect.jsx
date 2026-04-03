import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getUserByEmail } from "../services/supabaseapi";
import {
  getSignupRole,
  setRoleForEmail,
} from "../providers/roleStore";
/*
Determine what to load after auth0 handles login
Sign up automatically leads to login, so auth0 covers both

Basic account information uses localStorage. Functions can be found in roleStore.js
*/
const ADMIN_EMAILS = ["test@uwm.edu"];

export default function PostLoginRedirect() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth0();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    const redirectUser = async () => {
      const email = (user?.email || "").toLowerCase();

      // Hard-coded admin override
      if (email && ADMIN_EMAILS.includes(email)) {
        navigate("/admin", { replace: true });
        return;
      }

      if (!email) {
        navigate("/client/dashboard", { replace: true });
        return;
      }

      try {
        // getUserByEmail now uses .maybeSingle() — data is null when not found
        const { data, error } = await getUserByEmail(email);

        if (!error && data?.role) {
          setRoleForEmail(email, data.role);

          switch (data.role) {
            case "student": navigate("/student/dashboard", { replace: true }); return;
            case "client":  navigate("/client/dashboard",  { replace: true }); return;
            case "admin":   navigate("/admin",              { replace: true }); return;
          }
        }
      } catch (err) {
        console.error("PostLoginRedirect: failed to fetch role:", err);
      }

      // Fallback: use signup_role that was set before Auth0 redirect
      const signupRole = getSignupRole();
      if (signupRole === "student" || signupRole === "client") {
        setRoleForEmail(email, signupRole);
        navigate(
          signupRole === "student" ? "/student/dashboard" : "/client/dashboard",
          { replace: true }
        );
        return;
      }

      navigate("/client/dashboard", { replace: true });
    };

    redirectUser();
  }, [isLoading, isAuthenticated, user, navigate]);

  return <div className="container py-4">Redirecting…</div>;
}