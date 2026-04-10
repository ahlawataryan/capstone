import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useRef } from "react";
import { supabase } from "./supabaseconfig";
import { setRoleForEmail } from "./providers/roleStore";
import "bootstrap-icons/font/bootstrap-icons.css";
import { getUserByEmail, insertUser } from "./services/supabaseapi";

import Login from "./pages/login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import ClientDashboard from "./pages/client/ClientDashboard";
import PostLoginRedirect from "./pages/PostLoginRedirect";
import Profile from "./pages/Profile";
import Jobs from "./pages/Jobs";
import Bookings from "./pages/Bookings";
import Payment from "./pages/Payment";
import Reviews from "./pages/Reviews";
import Messages from "./pages/Messages";
/*
The component that acts as the basis of the project
Essentially renders all other parts of the project
Does a check to see if the user is authenticated to allow access through the RequireAuth component
Creates users in supabase
*/

//R=Check if a user is authenticated through auth0
function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();

  if (isLoading) return <div className="container py-4">Loading...</div>;

  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/" replace state={{ returnTo: location.pathname + location.search }} />
  );
}
//App function that returns whatever assets should be loaded
export default function App() {
  const { error, isAuthenticated, isLoading, user } = useAuth0();
  const syncedRef = useRef(false);

  useEffect(() => {
    // Guard: only run once per authenticated session
    if (isLoading || !isAuthenticated || !user?.email) return;
    if (syncedRef.current) return;
    syncedRef.current = true;

    const syncUser = async () => {
      const email = user.email.toLowerCase();
      const savedRole = localStorage.getItem("signup_role");

      try {
        // 1. Check if the user already exists
        const { data: existing, error: fetchError } = await supabase
          .from("users")
          .select("user_id, email, role")
          .eq("email", email)
          .maybeSingle(); // returns null (not error) when not found

        if (fetchError) {
          console.error("Error checking for existing user:", fetchError);
          return;
        }

        if (existing) {
          // User already exists — store role locally and stop
          if (existing.role) {
            setRoleForEmail(email, existing.role);
          }
          localStorage.removeItem("signup_role");
          return;
        }

        // 2. User doesn't exist — insert them
        const role = savedRole || "client";
        const { error: insertError } = await supabase
          .from("users")
          .insert({
            email,
            role,
            first_name: user.given_name || "",
            last_name:  user.family_name || "",
          });

        if (insertError) {
          // 409 can still happen in a race condition (two tabs) — treat as non-fatal
          if (insertError.code === "23505") {
            console.warn("User already exists (race condition), skipping insert.");
          } else {
            console.error("Failed to insert user:", insertError);
          }
        } else {
          setRoleForEmail(email, role);
        }
      } catch (err) {
        console.error("Unexpected error during user sync:", err);
      } finally {
        localStorage.removeItem("signup_role");
      }
    };

    syncUser();
  }, [user, isAuthenticated, isLoading]);

  // Reset the sync guard when the user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      syncedRef.current = false;
    }
  }, [isAuthenticated]);

  return (
    <>
      {error && (
        <div className="container py-3">
          <div className="alert alert-danger">{error.message}</div>
        </div>
      )}
      <Routes>
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/post-login" replace /> : <Login />}
        />

        <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
        <Route path="/client" element={<Navigate to="/client/dashboard" replace />} />

        <Route
          path="/post-login"
          element={
            <RequireAuth>
              <PostLoginRedirect />
            </RequireAuth>
          }
        />

        <Route
          path="/student/dashboard"
          element={
            <RequireAuth>
              <StudentDashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/client/dashboard"
          element={
            <RequireAuth>
              <ClientDashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminDashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/jobs"
          element={
            <RequireAuth>
              <Jobs />
            </RequireAuth>
          }
        />

        <Route
          path="/bookings"
          element={
            <RequireAuth>
              <Bookings />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />

        <Route
          path="/payment"
          element={
            <RequireAuth>
              <Payment />
            </RequireAuth>
          }
        />

        <Route
          path="/reviews"
          element={
            <RequireAuth>
              <Reviews />
            </RequireAuth>
          }
        />

        <Route
          path="/messages"
          element={
            <RequireAuth>
              <Messages />
            </RequireAuth>
          }
        />

        <Route
          path="*"
          element={
            isAuthenticated
              ? <Navigate to="/post-login" replace />
              : <Navigate to="/" replace />
          }
        />
      </Routes>
    </>
  );
}