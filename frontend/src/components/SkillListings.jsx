import { useEffect, useState } from "react";
import { supabase } from "../supabaseconfig";

export default function ClientJobsView() {
  const [students, setStudents] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [skillFilter, setSkillFilter] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");

  const [applied, setApplied] = useState({
    skill: "", maxPrice: "", location: "", availability: ""
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: studentData, error: studentError } = await supabase
          .from("users")
          .select(`
            user_id,
            first_name,
            last_name,
            email,
            bio,
            listings (
              listing_id,
              title,
              price_amount,
              pricing_type,
              location_text,
              status,
              listingsskills (
                skills (
                  skill_id,
                  name
                )
              )
            ),
            availabilityslots (
              slot_id,
              start_at,
              end_at,
              status
            )
          `)
          .eq("role", "student");

        if (studentError) throw studentError;
        const activeStudents = (studentData || []).filter(s =>
          s.listings?.some(l => l.status === "active")
        );
        setStudents(activeStudents);

        const { data: skillData, error: skillError } = await supabase
          .from("skills")
          .select("skill_id, name")
          .eq("is_active", true);

        if (skillError) throw skillError;
        setSkills(skillData || []);
      } catch (err) {
        console.error("Failed to fetch students:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleApplyFilters = () => {
    setApplied({
      skill: skillFilter,
      maxPrice,
      location: locationFilter,
      availability: availabilityFilter,
    });
  };

  const handleClearFilters = () => {
    setSkillFilter("");
    setMaxPrice("");
    setLocationFilter("");
    setAvailabilityFilter("");
    setApplied({ skill: "", maxPrice: "", location: "", availability: "" });
  };

  const getStudentSkills = (student) => {
    const allSkills = student.listings?.flatMap(l =>
      l.listingsskills?.map(ls => ls.skills) ?? []
    ) ?? [];
    return [...new Map(allSkills.map(s => [s?.skill_id, s])).values()].filter(Boolean);
  };

  const getMinPrice = (student) => {
    const prices = student.listings?.filter(l => l.status === "active").map(l => l.price_amount) ?? [];
    return prices.length ? Math.min(...prices) : null;
  };

  const getAvailability = (student) => {
    const slots = student.availabilityslots?.filter(s => s.status === "available") ?? [];
    if (!slots.length) return "Not available";
    const days = slots.map(s => new Date(s.start_at).toLocaleDateString("en-US", { weekday: "long" }));
    return [...new Set(days)].slice(0, 3).join(", ");
  };

  const filtered = students.filter(student => {
    const studentSkillNames = getStudentSkills(student).map(s => s.name);
    const minPrice = getMinPrice(student);
    if (applied.skill && !studentSkillNames.includes(applied.skill)) return false;
    if (applied.maxPrice && minPrice > Number(applied.maxPrice)) return false;
    if (applied.location) {
      const hasLocation = student.listings?.some(l =>
        l.location_text?.toLowerCase().includes(applied.location.toLowerCase())
      );
      if (!hasLocation) return false;
    }
    if (applied.availability) {
      const hasAvailability = student.availabilityslots?.some(s => s.status === applied.availability);
      if (!hasAvailability) return false;
    }
    return true;
  });

  const contactStudent = async (student) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .insert({ request_id: null, booking_id: null });
      if (error) throw error;
      alert(`Contact request sent to ${student.first_name}!`);
    } catch (err) {
      console.error("Failed to contact student:", err);
    }
  };

  if (loading) return <div>Loading students...</div>;

  return (
    <>
      <h2 className="mb-4">Browse Student Talent</h2>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Filter Students</h5>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Skill Type</label>
              <select className="form-select" value={skillFilter} onChange={e => setSkillFilter(e.target.value)}>
                <option value="">All Skills</option>
                {skills.map(s => <option key={s.skill_id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Max Price ($)</label>
              <input
                className="form-control"
                type="number"
                placeholder="e.g. 50"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Location</label>
              <input
                className="form-control"
                placeholder="e.g. Milwaukee"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Availability</label>
              <select className="form-select" value={availabilityFilter} onChange={e => setAvailabilityFilter(e.target.value)}>
                <option value="">Any</option>
                <option value="available">Available</option>
                <option value="booked">Booked</option>
              </select>
            </div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-primary" onClick={handleApplyFilters}>
                Apply Filters
              </button>
              <button className="btn btn-outline-secondary" onClick={handleClearFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">No students match your filters.</p>
      ) : (
        <div className="row g-3">
          {filtered.map(student => {
            const studentSkills = getStudentSkills(student);
            const minPrice = getMinPrice(student);
            const availability = getAvailability(student);
            const activeListings = student.listings?.filter(l => l.status === "active") ?? [];

            return (
              <div className="col-md-6" key={student.user_id}>
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h5 className="card-title">{student.first_name} {student.last_name}</h5>
                    {student.bio && <p className="small text-muted mb-2">{student.bio}</p>}
                    {minPrice !== null && <p className="text-muted mb-1">💰 From ${minPrice}</p>}
                    <p className="text-muted mb-1">📅 {availability}</p>
                    <p className="text-muted mb-2">📋 {activeListings.length} active listing{activeListings.length !== 1 ? "s" : ""}</p>
                    <div>
                      {studentSkills.map(s => (
                        <span key={s.skill_id} className="badge bg-success me-1 mb-1">{s.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="card-footer">
                    <button className="btn btn-success btn-sm w-100" onClick={() => contactStudent(student)}>
                      Contact Student
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}