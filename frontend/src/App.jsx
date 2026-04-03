import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getUserByEmail, insertUser, ensureUserExists } from "./services/supabaseapi";
import { useEffect } from "react";

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

  useEffect(() => {
    const syncUser = async () => {
      if (isLoading || !isAuthenticated || !user?.email) return;

      //This wasn't working because the userServices only returns the data part. Needed to
      //update the checks accordingly
      const {existingUserData, existingUserError} = await getUserByEmail(user.email);
      const savedRole = localStorage.getItem("signup_role") || "student";

      console.log("signup_role from localStorage:", savedRole);
    /*
      if (!existingUser) {
        await createUser({
          email: user.email,
          first_name: user.given_name || "",
          last_name: user.family_name || "",
          role: savedRole || "client",
        });
      }
    */
     
     if (!existingUserData) {
        await insertUser({
          email: user.email,
          role: savedRole || "client",
          first_name: user.given_name || "",
          last_name: user.family_name || "",
          phone: "0000000000",
          bio: "",
        });
      }
      
      localStorage.removeItem("signup_role");
    };

    syncUser();
  }, [user, isAuthenticated, isLoading]);

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
            isAuthenticated ? <Navigate to="/post-login" replace /> : <Navigate to="/" replace />
          }
        />
      </Routes>
    </>
  );
}