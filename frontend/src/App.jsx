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
>>>>>>> Stashed changes

export default function App() {
  const { isLoading, isAuthenticated } = useAuth0();

export default function App() {
  const { error, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <div className="container py-4">Loading...</div>;

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        <Login />
      ) : (
        <>
          {/* Navbar ALWAYS visible when logged in */}
          <Navbar />

          {/* Page content changes below */}
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </>
      )}
    </BrowserRouter>
  );
}