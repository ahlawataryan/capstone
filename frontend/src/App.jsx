import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Profile from "./pages/Profile";
<<<<<<< Updated upstream
=======
import Jobs from "./pages/Jobs";
import Reviews from "./pages/Reviews";
import { useLocation } from "react-router-dom";
import Messages from "./pages/Messages";

export default function App() {
  const { error, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <div className="container py-4">Loading...</div>;

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
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
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

        {/* Catch-all MUST be last */}
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