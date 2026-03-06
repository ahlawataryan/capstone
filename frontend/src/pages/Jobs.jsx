import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Navbar from "../components/Navbar";
import JobListings from "../components/Jobs/JobListings.jsx";
import SkillListings from "../components/Jobs/SkillListings.jsx";
import { supabase } from "../supabaseconfig.js";

export default function Jobs() {
  const { user } = useAuth0();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("role")
          .eq("email", user.email)
          .single();

        if (error) throw error;
        setRole(data.role);
      } catch (err) {
        console.error("Failed to fetch role:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) fetchRole();
  }, [user]);

  if (loading) return <div className="container py-4">Loading...</div>;

  return (
    <>
      <Navbar/>
      <div className="container py-4">
        {role === "student" ? <JobListings /> : <SkillListings />}
      </div>
    </>
  );
}