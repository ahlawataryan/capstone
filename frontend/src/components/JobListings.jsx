import { useEffect, useState } from "react";
import { supabase } from "../supabaseconfig";

export default function StudentJobsView() {
  const [listings, setListings] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [skillFilter, setSkillFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [minPay, setMinPay] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [pricingType, setPricingType] = useState("");

  const [applied, setApplied] = useState({
    skill: "", location: "", minPay: "", date: "", pricingType: ""
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: listingData, error: listingError } = await supabase
          .from("listings")
          .select(`
            listing_id,
            title,
            description,
            location_text,
            pricing_type,
            price_amount,
            created_at,
            status,
            student_id,
            users!listings_student_id_fkey (
              first_name,
              last_name
            ),
            listingsskills (
              skills (
                skill_id,
                name
              )
            )
          `)
          .eq("status", "active");

        if (listingError) throw listingError;
        setListings(listingData || []);

        const { data: skillData, error: skillError } = await supabase
          .from("skills")
          .select("skill_id, name")
          .eq("is_active", true);

        if (skillError) throw skillError;
        setSkills(skillData || []);
      } catch (err) {
        console.error("Failed to fetch listings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleApplyFilters = () => {
    setApplied({
      skill: skillFilter,
      location: locationFilter,
      minPay,
      date: dateFilter,
      pricingType,
    });
  };

  const handleClearFilters = () => {
    setSkillFilter("");
    setLocationFilter("");
    setMinPay("");
    setDateFilter("");
    setPricingType("");
    setApplied({ skill: "", location: "", minPay: "", date: "", pricingType: "" });
  };

  const filtered = listings.filter(listing => {
    const listingSkillNames = listing.listingsskills?.map(ls => ls.skills?.name) ?? [];
    if (applied.skill && !listingSkillNames.includes(applied.skill)) return false;
    if (applied.location && !listing.location_text?.toLowerCase().includes(applied.location.toLowerCase())) return false;
    if (applied.minPay && listing.price_amount < Number(applied.minPay)) return false;
    if (applied.date && new Date(listing.created_at) < new Date(applied.date)) return false;
    if (applied.pricingType && listing.pricing_type !== applied.pricingType) return false;
    return true;
  });

  const applyForListing = async (listing_id) => {
    try {
      const { error } = await supabase
        .from("bookingrequests")
        .insert({
          customer_id: null,
          listing_id,
          requested_start_at: new Date().toISOString(),
          requested_end_at: new Date().toISOString(),
          status: "pending",
        });
      if (error) throw error;
      alert("Application submitted!");
    } catch (err) {
      console.error("Failed to apply:", err);
      alert("Failed to submit application.");
    }
  };

  if (loading) return <div>Loading listings...</div>;

  return (
    <>
      <h2 className="mb-4">Available Jobs</h2>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Filter Jobs</h5>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Skill Required</label>
              <select className="form-select" value={skillFilter} onChange={e => setSkillFilter(e.target.value)}>
                <option value="">All Skills</option>
                {skills.map(s => <option key={s.skill_id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Location</label>
              <input
                className="form-control"
                placeholder="e.g. Milwaukee"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Minimum Pay ($)</label>
              <input
                className="form-control"
                type="number"
                placeholder="e.g. 20"
                value={minPay}
                onChange={e => setMinPay(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Posted After</label>
              <input
                className="form-control"
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Pricing Type</label>
              <select className="form-select" value={pricingType} onChange={e => setPricingType(e.target.value)}>
                <option value="">Any</option>
                <option value="hourly">Hourly</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div className="col-md-4 d-flex align-items-end gap-2">
              <button className="btn btn-primary w-100" onClick={handleApplyFilters}>
                Apply Filters
              </button>
              <button className="btn btn-outline-secondary w-100" onClick={handleClearFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">No jobs match your filters.</p>
      ) : (
        <div className="row g-3">
          {filtered.map(listing => (
            <div className="col-md-6" key={listing.listing_id}>
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <h5 className="card-title">{listing.title}</h5>
                  <p className="text-muted small mb-1">
                    Posted by {listing.users?.first_name} {listing.users?.last_name}
                  </p>
                  {listing.description && <p className="mb-2 small">{listing.description}</p>}
                  <p className="text-muted mb-1">Location: {listing.location_text || "Remote"}</p>
                  <p className="text-muted mb-1">Rate: ${listing.price_amount} ({listing.pricing_type})</p>
                  <p className="text-muted mb-2">Date: {new Date(listing.created_at).toLocaleDateString()}</p>
                  <div>
                    {listing.listingsskills?.map(ls => (
                      <span key={ls.skills?.skill_id} className="badge bg-primary me-1">{ls.skills?.name}</span>
                    ))}
                  </div>
                </div>
                <div className="card-footer">
                  <button className="btn btn-primary btn-sm w-100" onClick={() => applyForListing(listing.listing_id)}>
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}