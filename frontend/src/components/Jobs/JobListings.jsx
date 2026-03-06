import { useState } from "react";

const MOCK_JOBS = [
  { id: 1, title: "Web Developer", skills: ["React", "Node.js"], location: "Milwaukee, WI", pay: 25, date: "2026-03-01", time: "9:00 AM" },
  { id: 2, title: "Graphic Designer", skills: ["Photoshop", "Illustrator"], location: "Remote", pay: 20, date: "2026-03-05", time: "2:00 PM" },
  { id: 3, title: "Data Analyst", skills: ["Python", "Excel"], location: "Chicago, IL", pay: 30, date: "2026-03-10", time: "10:00 AM" },
  { id: 4, title: "Tutor", skills: ["Math", "Physics"], location: "Milwaukee, WI", pay: 15, date: "2026-03-12", time: "4:00 PM" },
];

const ALL_SKILLS = [...new Set(MOCK_JOBS.flatMap(j => j.skills))];

export default function JobListings() {
  const [skillFilter, setSkillFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [minPay, setMinPay] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");

  const filtered = MOCK_JOBS.filter(job => {
    if (skillFilter && !job.skills.includes(skillFilter)) return false;
    if (locationFilter && !job.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    if (minPay && job.pay < Number(minPay)) return false;
    if (dateFilter && job.date < dateFilter) return false;
    if (timeFilter && job.time < timeFilter) return false;
    return true;
  });

  return (
    <>
      <h2 className="mb-4">Available Jobs</h2>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Filter Jobs</h5>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Skill Required</label>
              <select className="form-select" value={skillFilter} onChange={e => setSkillFilter(e.target.value)}>
                <option value="">All Skills</option>
                {ALL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
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
              <label className="form-label">Minimum Pay ($/hr)</label>
              <input
                className="form-control"
                type="number"
                placeholder="e.g. 20"
                value={minPay}
                onChange={e => setMinPay(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Date (on or after)</label>
              <input
                className="form-control"
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Time (on or after)</label>
              <input
                className="form-control"
                type="time"
                value={timeFilter}
                onChange={e => setTimeFilter(e.target.value)}
              />
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <button className="btn btn-outline-secondary w-100" onClick={() => {
                setSkillFilter(""); setLocationFilter(""); setMinPay("");
                setDateFilter(""); setTimeFilter("");
              }}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Job Cards */}
      {filtered.length === 0 ? (
        <p className="text-muted">No jobs match your filters.</p>
      ) : (
        <div className="row g-3">
          {filtered.map(job => (
            <div className="col-md-6" key={job.id}>
              <div className="card h-100 shadow-sm">
                <div className="card-header">
                  <h5 className="card-title mb-0">{job.title}</h5>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-1">Location: {job.location}</p>
                  <p className="text-muted mb-1">Rate: ${job.pay}/hr</p>
                  <p className="text-muted mb-1">Date: {job.date} at {job.time}</p>
                  <div className="mt-2">
                    {job.skills.map(s => (
                      <span key={s} className="badge bg-primary me-1">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="card-footer">
                  <button className="btn btn-primary btn-sm w-100">Apply</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}