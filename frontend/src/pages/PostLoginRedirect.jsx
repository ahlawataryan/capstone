import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../supabaseconfig";

const ADMIN_EMAILS = ["test@uwm.edu"];

export default function PostLoginRedirect() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth0();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    const email = (user?.email || "").toLowerCase();

    if (!email) {
      navigate("/client/dashboard", { replace: true });
      return;
    }

    if (ADMIN_EMAILS.includes(email)) {
      navigate("/admin", { replace: true });
      return;
    }

    const fetchRoleAndRedirect = async () => {
      try {
        // Check if user already exists in Supabase
        const { data: existing, error: fetchError } = await supabase
          .from("users")
          .select("role")
          .eq("email", email)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

        if (existing) {
          // User exists — route by their stored role
          switch (existing.role) {
            case "admin":   return navigate("/admin", { replace: true });
            case "student": return navigate("/student/dashboard", { replace: true });
            default:        return navigate("/client/dashboard", { replace: true });
          }
        } else {
          // First time login — insert user with signup role from localStorage
          const signupRole = localStorage.getItem("signup_role");
          const role = signupRole === "student" ? "student" : "customer";
          localStorage.removeItem("signup_role");

          const { error: insertError } = await supabase
            .from("users")
            .insert({
              email,
              role,
              first_name: user.given_name || "",
              last_name: user.family_name || "",
            });

          if (insertError) throw insertError;

          if (role === "student") navigate("/student/dashboard", { replace: true });
          else navigate("/client/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("PostLoginRedirect error:", err);
        navigate("/client/dashboard", { replace: true });
      }
    };

    fetchRoleAndRedirect();
  }, [isLoading, isAuthenticated, user, navigate]);

  return <div className="container py-4">Redirecting...</div>;
}