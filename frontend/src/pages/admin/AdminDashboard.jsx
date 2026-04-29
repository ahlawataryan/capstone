import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Navbar from "../../components/Navbar.jsx";
import {
  getAllUsers,
  getActiveListings,
  hardDeleteListingFull,
  deactivateUser,
  hardDeleteUserAccount,
  rejectDeletionRequest,
  getPendingListingReports,
  getPendingUserReports,
  getUserByEmail,
  sendAdminMessageToUser,
  resolveListingReport,
  resolveUserReport,
} from "../../services/supabaseapi.jsx";

export default function AdminDashboard() {
  const { user } = useAuth0();

  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [listingReports, setListingReports] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [userFilter, setUserFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [userSort, setUserSort] = useState({ key: "user_id", dir: "asc" });
  const [listingSort, setListingSort] = useState({ key: "listing_id", dir: "asc" });

  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewAction, setReviewAction] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const [rejectReasonModal, setRejectReasonModal] = useState(null);
  const [rejectReasonText, setRejectReasonText] = useState("");

  const [listingReviewModal, setListingReviewModal] = useState(null);
  const [listingReviewReason, setListingReviewReason] = useState("");
  const [listingReviewLoading, setListingReviewLoading] = useState(false);

  const [userReportModal, setUserReportModal] = useState(null);
  const [userReportAction, setUserReportAction] = useState("");
  const [userReportNote, setUserReportNote] = useState("");
  const [userReportLoading, setUserReportLoading] = useState(false);
  const [userReportError, setUserReportError] = useState(null);

  const [activeSection, setActiveSection] = useState("users");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        { data: userData, error: userErr },
        { data: listingData, error: listingErr },
        { data: listingReportData, error: listingReportErr },
        { data: userReportData, error: userReportErr },
      ] = await Promise.all([
        getAllUsers(),
        getActiveListings(),
        getPendingListingReports(),
        getPendingUserReports(),
      ]);

      if (userErr) throw userErr;
      if (listingErr) throw listingErr;
      if (listingReportErr) throw listingReportErr;
      if (userReportErr) throw userReportErr;

      setUsers(userData || []);
      setListings(listingData || []);
      setListingReports(listingReportData || []);
      setUserReports(userReportData || []);
    } catch (err) {
      console.error("Admin dashboard load error:", err);
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await hardDeleteListingFull(deleteTarget.listing_id);
      if (error) throw error;

      setListings((prev) =>
        prev.filter((l) => l.listing_id !== deleteTarget.listing_id)
      );

      setListingReports((prev) =>
        prev.filter((r) => r.listing_id !== deleteTarget.listing_id)
      );

      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete listing:", err);
      setDeleteError(err.message || "Failed to delete listing.");
    } finally {
      setDeleting(false);
    }
  };

  const handleReviewAction = async () => {
    if (!reviewTarget || !reviewAction) return;

    setReviewLoading(true);
    setReviewError(null);

    try {
      let result;

      if (reviewAction === "deactivate") {
        result = await deactivateUser(reviewTarget.user_id);
      } else if (reviewAction === "approve_delete_request") {
        result = await hardDeleteUserAccount(reviewTarget.user_id);
      } else if (reviewAction === "reject_delete_request") {
        const adminEmail = (user?.email || "").toLowerCase();
        const { data: adminDbUser, error: adminError } = await getUserByEmail(adminEmail);

        if (adminError || !adminDbUser) {
          throw new Error("Could not find admin account.");
        }

        result = await rejectDeletionRequest(
          reviewTarget.user_id,
          rejectReasonText.trim()
        );
        if (result?.error) throw result.error;

        const messageResult = await sendAdminMessageToUser(
          adminDbUser.user_id,
          reviewTarget.user_id,
          `Your account deletion request was denied. Reason: ${rejectReasonText.trim()}`
        );

        if (messageResult?.error) throw messageResult.error;
      }

      if (result?.error) throw result.error;

      if (reviewAction === "approve_delete_request") {
        setUsers((prev) =>
          prev.filter((u) => u.user_id !== reviewTarget.user_id)
        );

        setListings((prev) =>
          prev.filter((l) => l.student_id !== reviewTarget.user_id)
        );

        setListingReports((prev) =>
          prev.filter((r) => r.listing_owner_user_id !== reviewTarget.user_id)
        );
      } else {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.user_id !== reviewTarget.user_id) return u;

            if (reviewAction === "deactivate") {
              return {
                ...u,
                is_active: false,
                account_status: "deleted",
              };
            }

            if (reviewAction === "reject_delete_request") {
              return {
                ...u,
                delete_requested: false,
                delete_request_status: "denied",
                delete_request_review_note: rejectReasonText.trim(),
                account_status: "active",
              };
            }

            return u;
          })
        );
      }

      setReviewTarget(null);
      setReviewAction("");
      setRejectReasonModal(null);
      setRejectReasonText("");
    } catch (err) {
      console.error("Failed admin account action:", err);
      setReviewError(err.message || "Failed to complete admin action.");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDismissListingReports = async () => {
    if (!listingReviewModal || !listingReviewReason.trim()) return;

    try {
      setListingReviewLoading(true);

      const adminEmail = (user?.email || "").toLowerCase();
      const { data: adminDbUser, error: adminError } = await getUserByEmail(adminEmail);

      if (adminError || !adminDbUser) {
        throw new Error("Could not find admin account.");
      }

      for (const report of listingReviewModal.reports) {
        const { error: resolveError } = await resolveListingReport(
          report.report_id,
          "resolved",
          listingReviewReason.trim()
        );
        if (resolveError) throw resolveError;

        const messageResult = await sendAdminMessageToUser(
          adminDbUser.user_id,
          report.reported_by_user_id,
          `Your report for listing "${listingReviewModal.listing.title}" was reviewed by admin. Decision note: ${listingReviewReason.trim()}`
        );
        if (messageResult?.error) throw messageResult.error;
      }

      setListingReports((prev) =>
        prev.filter((r) => r.listing_id !== listingReviewModal.listing.listing_id)
      );

      setListingReviewModal(null);
      setListingReviewReason("");
    } catch (err) {
      console.error("Failed to dismiss listing reports:", err);
      setError(err.message || "Failed to review listing reports.");
    } finally {
      setListingReviewLoading(false);
    }
  };

  const handleUserReportAction = async () => {
    if (!userReportModal || !userReportAction) return;

    setUserReportLoading(true);
    setUserReportError(null);

    try {
      const adminEmail = (user?.email || "").toLowerCase();
      const { data: adminDbUser, error: adminError } = await getUserByEmail(adminEmail);
      if (adminError || !adminDbUser) throw new Error("Could not find admin account.");

      const reportedUser = userReportModal.reportedUser;
      const reports = userReportModal.reports;

      // Resolve all pending reports for this user
      for (const report of reports) {
        const { error: resolveErr } = await resolveUserReport(
          report.report_id,
          userReportAction === "deactivate" ? "resolved" : "dismissed",
          userReportNote.trim() || null
        );
        if (resolveErr) throw resolveErr;
      }

      if (userReportAction === "deactivate") {
        // Deactivate the reported user's account
        const { error: deactivateErr } = await deactivateUser(reportedUser.user_id);
        if (deactivateErr) throw deactivateErr;

        // Notify the reported user
        await sendAdminMessageToUser(
          adminDbUser.user_id,
          reportedUser.user_id,
          `Your account has been deactivated following a review of scam-related reports against your account.${userReportNote.trim() ? ` Admin note: ${userReportNote.trim()}` : ""}`
        );

        // Notify each reporter
        for (const report of reports) {
          await sendAdminMessageToUser(
            adminDbUser.user_id,
            report.reported_by_user_id,
            `Your report against ${reportedUser.first_name} ${reportedUser.last_name} has been reviewed. The account has been deactivated.`
          );
        }

        // Update users list to reflect deactivation
        setUsers((prev) =>
          prev.map((u) =>
            u.user_id === reportedUser.user_id
              ? { ...u, is_active: false, account_status: "deleted" }
              : u
          )
        );
      } else {
        // Dismissed — notify reporters
        for (const report of reports) {
          await sendAdminMessageToUser(
            adminDbUser.user_id,
            report.reported_by_user_id,
            `Your report against ${reportedUser.first_name} ${reportedUser.last_name} was reviewed and dismissed.${userReportNote.trim() ? ` Admin note: ${userReportNote.trim()}` : ""}`
          );
        }
      }

      // Remove resolved reports from local state
      setUserReports((prev) =>
        prev.filter((r) => r.reported_user_id !== reportedUser.user_id)
      );

      setUserReportModal(null);
      setUserReportAction("");
      setUserReportNote("");
    } catch (err) {
      console.error("Failed to process user report action:", err);
      setUserReportError(err.message || "Failed to complete action.");
    } finally {
      setUserReportLoading(false);
    }
  };

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  // Group pending user reports by the reported user for the review panel
  const userReportsByUser = useMemo(() => {
    const map = {};
    userReports.forEach((report) => {
      const uid = report.reported_user_id;
      if (!map[uid]) {
        map[uid] = { reportedUser: report.reported_user, reports: [] };
      }
      map[uid].reports.push(report);
    });
    return Object.values(map);
  }, [userReports]);

  // Count users who have submitted a deletion request and are still active
  const pendingDeletionCount = useMemo(
    () => users.filter((u) => u.delete_requested && u.is_active !== false).length,
    [users]
  );

  const toggleSort = (current, setCurrent, key) => {
    setCurrent((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  };

  const SortArrow = ({ active, dir }) => {
    if (!active) return <span className="text-muted ms-1">↕</span>;
    return <span className="ms-1 small">{dir === "asc" ? "▲" : "▼"}</span>;
  };

  const compareValues = (a, b, dir = "asc") => {
    const av = a ?? "";
    const bv = b ?? "";

    if (typeof av === "number" && typeof bv === "number") {
      return dir === "asc" ? av - bv : bv - av;
    }

    const aDate = av instanceof Date ? av.getTime() : null;
    const bDate = bv instanceof Date ? bv.getTime() : null;
    if (aDate !== null && bDate !== null) {
      return dir === "asc" ? aDate - bDate : bDate - aDate;
    }

    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    if (as < bs) return dir === "asc" ? -1 : 1;
    if (as > bs) return dir === "asc" ? 1 : -1;
    return 0;
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      const matchName = !userFilter || fullName.includes(userFilter.toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      return matchName && matchRole;
    });
  }, [users, userFilter, roleFilter]);

  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsers];

    copy.sort((a, b) => {
      let av, bv;

      switch (userSort.key) {
        case "name":
          av = `${a.first_name} ${a.last_name}`;
          bv = `${b.first_name} ${b.last_name}`;
          break;
        case "role":
          av = a.role;
          bv = b.role;
          break;
        case "report_count":
          av = a.report_count || 0;
          bv = b.report_count || 0;
          break;
        case "account_status":
          av = a.account_status || "active";
          bv = b.account_status || "active";
          break;
        case "user_id":
        default:
          av = a.user_id;
          bv = b.user_id;
          break;
      }

      return compareValues(av, bv, userSort.dir);
    });

    return copy;
  }, [filteredUsers, userSort]);

  const sortedListings = useMemo(() => {
    const copy = [...listings];

    copy.sort((a, b) => {
      let av, bv;

      switch (listingSort.key) {
        case "title":
          av = a.title;
          bv = b.title;
          break;
        case "posted_by":
          av = `${a.users?.first_name || ""} ${a.users?.last_name || ""}`;
          bv = `${b.users?.first_name || ""} ${b.users?.last_name || ""}`;
          break;
        case "rate":
          av = a.price_amount;
          bv = b.price_amount;
          break;
        case "location":
          av = a.location_text || "Remote";
          bv = b.location_text || "Remote";
          break;
        case "created":
          av = new Date(a.created_at);
          bv = new Date(b.created_at);
          break;
        case "listing_id":
        default:
          av = a.listing_id;
          bv = b.listing_id;
          break;
      }

      return compareValues(av, bv, listingSort.dir);
    });

    return copy;
  }, [listings, listingSort]);

  const listingReportCounts = useMemo(() => {
    const counts = {};
    listingReports.forEach((report) => {
      counts[report.listing_id] = (counts[report.listing_id] || 0) + 1;
    });
    return counts;
  }, [listingReports]);

  return (
    <>
      <Navbar />

      <div className="container py-4" style={{ maxWidth: "1320px" }}>
        <div className="mb-4">
          <h1 className="h2 fw-semibold mb-1">Admin Dashboard</h1>
          <p className="text-muted mb-0">
            Review users, monitor listings, and handle account and report actions.
          </p>
        </div>

        {error && <div className="alert alert-danger mb-4">{error}</div>}

        <div className="row g-3 mb-4">
          {[
            { label: "Total Users", value: users.length, tone: "primary" },
            { label: "Students", value: roleCounts.student || 0, tone: "success" },
            { label: "Clients", value: roleCounts.client || 0, tone: "info" },
            { label: "Active Listings", value: listings.length, tone: "warning" },
            { label: "User Reports", value: userReports.length, tone: "danger" },
            { label: "Deletion Requests", value: pendingDeletionCount, tone: "secondary" },
          ].map(({ label, value, tone }) => (
            <div className="col-6 col-lg-2" key={label}>
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body py-3 px-4">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small mb-1">{label}</div>
                      <div className={`fs-3 fw-semibold text-${tone}`}>
                        {loading ? "…" : value}
                      </div>
                    </div>
                    <span className={`badge rounded-pill text-bg-${tone}`}>
                      Live
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="d-flex flex-wrap gap-2 mb-4">
          <button
            className={`btn ${activeSection === "users" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setActiveSection("users")}
          >
            Users
          </button>

          <button
            className={`btn ${activeSection === "listings" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setActiveSection("listings")}
          >
            Listings
          </button>

          <button
            className={`btn position-relative ${activeSection === "userReports" ? "btn-danger" : "btn-outline-danger"}`}
            onClick={() => setActiveSection("userReports")}
          >
            User Reports
            {userReports.length > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-dark">
                {userReportsByUser.length}
              </span>
            )}
          </button>

          <button
            className={`btn position-relative ${activeSection === "deletionRequests" ? "btn-secondary" : "btn-outline-secondary"}`}
            onClick={() => setActiveSection("deletionRequests")}
          >
            Deletion Requests
            {pendingDeletionCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-dark">
                {pendingDeletionCount}
              </span>
            )}
          </button>
        </div>

        {activeSection === "users" && (
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body p-0">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 px-4 py-3 border-bottom">
                <div>
                  <h5 className="mb-1">Users</h5>
                  <p className="text-muted small mb-0">
                    Search accounts and review flagged or deletion-requested users in a dedicated view.
                  </p>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search by name"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    style={{ width: 200 }}
                  />
                  <select
                    className="form-select form-select-sm"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={{ width: 130 }}
                  >
                    <option value="">All roles</option>
                    <option value="student">Student</option>
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <p className="text-muted px-4 py-4 mb-0">Loading…</p>
              ) : sortedUsers.length === 0 ? (
                <p className="text-muted px-4 py-4 mb-0">No users match your filters.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(userSort, setUserSort, "user_id")}
                        >
                          #
                          <SortArrow active={userSort.key === "user_id"} dir={userSort.dir} />
                        </th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(userSort, setUserSort, "name")}
                        >
                          Name
                          <SortArrow active={userSort.key === "name"} dir={userSort.dir} />
                        </th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(userSort, setUserSort, "role")}
                        >
                          Role
                          <SortArrow active={userSort.key === "role"} dir={userSort.dir} />
                        </th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(userSort, setUserSort, "report_count")}
                        >
                          Reports
                          <SortArrow active={userSort.key === "report_count"} dir={userSort.dir} />
                        </th>
                        <th className="small">Delete Request</th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(userSort, setUserSort, "account_status")}
                        >
                          Status
                          <SortArrow
                            active={userSort.key === "account_status"}
                            dir={userSort.dir}
                          />
                        </th>
                        <th className="small">Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedUsers.map((u) => (
                        <tr key={u.user_id}>
                          <td className="text-muted small">{u.user_id}</td>
                          <td>
                            <div className="fw-medium">
                              {u.first_name} {u.last_name}
                            </div>
                            <div className="text-muted small">{u.email}</div>
                          </td>
                          <td>
                            <span
                              className={`badge rounded-pill ${
                                u.role === "admin"
                                  ? "text-bg-danger"
                                  : u.role === "student"
                                  ? "text-bg-success"
                                  : "text-bg-info"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td>
                            {u.report_count > 0 ? (
                              <span className="badge rounded-pill text-bg-warning">
                                {u.report_count}
                              </span>
                            ) : (
                              <span className="text-muted small">0</span>
                            )}
                          </td>
                          <td>
                            {u.delete_requested ? (
                              <span className="badge rounded-pill text-bg-warning">
                                Requested
                              </span>
                            ) : (
                              <span className="text-muted small">No</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`badge rounded-pill ${
                                u.account_status === "deleted"
                                  ? "text-bg-dark"
                                  : u.account_status === "flagged"
                                  ? "text-bg-warning"
                                  : u.account_status === "suspended"
                                  ? "text-bg-secondary"
                                  : "text-bg-primary"
                              }`}
                            >
                              {u.account_status || "active"}
                            </span>
                          </td>
                          <td>
                            {(u.report_count >= 3 || u.delete_requested) &&
                            u.is_active !== false ? (
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => {
                                  if (u.delete_requested) {
                                    setReviewTarget(u);
                                    setReviewAction("approve_delete_request");
                                  } else {
                                    setReviewTarget(u);
                                    setReviewAction("deactivate");
                                  }
                                  setReviewError(null);
                                }}
                              >
                                Review
                              </button>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === "listings" && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              <div className="px-4 py-3 border-bottom">
                <h5 className="mb-1">Active Job Listings</h5>
                <p className="text-muted small mb-0">
                  Review reported listings in a separate listings view.
                </p>
              </div>

              {loading ? (
                <p className="text-muted px-4 py-4 mb-0">Loading…</p>
              ) : sortedListings.length === 0 ? (
                <p className="text-muted px-4 py-4 mb-0">No active listings.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(listingSort, setListingSort, "listing_id")}
                        >
                          #
                          <SortArrow active={listingSort.key === "listing_id"} dir={listingSort.dir} />
                        </th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(listingSort, setListingSort, "title")}
                        >
                          Title
                          <SortArrow active={listingSort.key === "title"} dir={listingSort.dir} />
                        </th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(listingSort, setListingSort, "posted_by")}
                        >
                          Posted by
                          <SortArrow active={listingSort.key === "posted_by"} dir={listingSort.dir} />
                        </th>
                        <th className="small">Reports</th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(listingSort, setListingSort, "rate")}
                        >
                          Rate
                          <SortArrow active={listingSort.key === "rate"} dir={listingSort.dir} />
                        </th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(listingSort, setListingSort, "location")}
                        >
                          Location
                          <SortArrow active={listingSort.key === "location"} dir={listingSort.dir} />
                        </th>
                        <th
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSort(listingSort, setListingSort, "created")}
                        >
                          Created
                          <SortArrow active={listingSort.key === "created"} dir={listingSort.dir} />
                        </th>
                        <th className="small">Review</th>
                        <th className="small">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedListings.map((l) => {
                        const pendingCount = listingReportCounts[l.listing_id] || 0;

                        return (
                          <tr key={l.listing_id}>
                            <td className="text-muted small">{l.listing_id}</td>
                            <td>
                              <div className="fw-medium">{l.title}</div>
                              <div className="text-muted small">
                                {l.pricing_type === "hourly" ? "Hourly" : "Fixed"}
                              </div>
                            </td>
                            <td>{l.users?.first_name} {l.users?.last_name}</td>
                            <td>
                              {pendingCount > 0 ? (
                                <span className="badge rounded-pill text-bg-danger">
                                  {pendingCount}
                                </span>
                              ) : (
                                <span className="text-muted small">0</span>
                              )}
                            </td>
                            <td>
                              ${l.price_amount}{" "}
                              <span className="text-muted small">/ {l.pricing_type}</span>
                            </td>
                            <td>
                              {l.location_text || <span className="text-muted">Remote</span>}
                            </td>
                            <td className="text-muted small">
                              {new Date(l.created_at).toLocaleDateString()}
                            </td>
                            <td>
                              {pendingCount > 0 ? (
                                <button
                                  className="btn btn-outline-warning btn-sm"
                                  onClick={() => {
                                    const matchingReports = listingReports.filter(
                                      (r) => r.listing_id === l.listing_id
                                    );
                                    setListingReviewModal({
                                      listing: l,
                                      reports: matchingReports,
                                    });
                                    setListingReviewReason("");
                                  }}
                                >
                                  Review
                                </button>
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </td>
                            <td>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => setDeleteTarget(l)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── USER REPORTS SECTION ──────────────────────────────────── */}
        {activeSection === "userReports" && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              <div className="px-4 py-3 border-bottom">
                <h5 className="mb-1">User Reports</h5>
                <p className="text-muted small mb-0">
                  Review scam-related and other reports filed against users. Deactivate accounts with sufficient evidence.
                </p>
              </div>

              {loading ? (
                <p className="text-muted px-4 py-4 mb-0">Loading…</p>
              ) : userReportsByUser.length === 0 ? (
                <p className="text-muted px-4 py-4 mb-0">No pending user reports.</p>
              ) : (
                <div className="p-4 d-flex flex-column gap-3">
                  {userReportsByUser.map(({ reportedUser, reports }) => {
                    if (!reportedUser) return null;
                    const scamCount = reports.filter((r) =>
                      (r.reason || "").toLowerCase().includes("scam")
                    ).length;

                    return (
                      <div
                        key={reportedUser.user_id}
                        className="border rounded-4 p-4"
                      >
                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
                          <div>
                            <div className="fw-semibold fs-6">
                              {reportedUser.first_name} {reportedUser.last_name}
                            </div>
                            <div className="text-muted small">{reportedUser.email}</div>
                          </div>
                          <div className="d-flex gap-2 align-items-center flex-wrap">
                            <span className="badge rounded-pill text-bg-danger">
                              {reports.length} report{reports.length !== 1 ? "s" : ""}
                            </span>
                            {scamCount > 0 && (
                              <span className="badge rounded-pill text-bg-warning">
                                {scamCount} scam-related
                              </span>
                            )}
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => {
                                setUserReportModal({ reportedUser, reports });
                                setUserReportAction("dismiss");
                                setUserReportNote("");
                                setUserReportError(null);
                              }}
                            >
                              Dismiss All
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                setUserReportModal({ reportedUser, reports });
                                setUserReportAction("deactivate");
                                setUserReportNote("");
                                setUserReportError(null);
                              }}
                            >
                              Deactivate Account
                            </button>
                          </div>
                        </div>

                        <div className="d-flex flex-column gap-2">
                          {reports.map((report) => (
                            <div
                              key={report.report_id}
                              className="bg-light rounded-3 p-3"
                            >
                              <div className="d-flex justify-content-between flex-wrap gap-2 mb-1">
                                <span className="small fw-medium">
                                  Reported by:{" "}
                                  {report.reported_by?.first_name}{" "}
                                  {report.reported_by?.last_name}
                                  <span className="text-muted ms-1">
                                    ({report.reported_by?.email})
                                  </span>
                                </span>
                                <span className="badge rounded-pill text-bg-secondary small">
                                  {report.reason}
                                </span>
                              </div>
                              {report.details && (
                                <div className="text-muted small">{report.details}</div>
                              )}
                              <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                {new Date(report.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DELETION REQUESTS SECTION ─────────────────────────────── */}
        {activeSection === "deletionRequests" && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              <div className="px-4 py-3 border-bottom">
                <h5 className="mb-1">Account Deletion Requests</h5>
                <p className="text-muted small mb-0">
                  Students and clients who have voluntarily requested their account be deleted. Approve to permanently remove their data, or reject with a reason.
                </p>
              </div>

              {loading ? (
                <p className="text-muted px-4 py-4 mb-0">Loading…</p>
              ) : users.filter((u) => u.delete_requested && u.is_active !== false).length === 0 ? (
                <p className="text-muted px-4 py-4 mb-0">No pending deletion requests.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="small">#</th>
                        <th className="small">User</th>
                        <th className="small">Role</th>
                        <th className="small">Reason</th>
                        <th className="small">Status</th>
                        <th className="small">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter((u) => u.delete_requested && u.is_active !== false)
                        .map((u) => (
                          <tr key={u.user_id}>
                            <td className="text-muted small">{u.user_id}</td>
                            <td>
                              <div className="fw-medium">
                                {u.first_name} {u.last_name}
                              </div>
                              <div className="text-muted small">{u.email}</div>
                            </td>
                            <td>
                              <span
                                className={`badge rounded-pill ${
                                  u.role === "student"
                                    ? "text-bg-success"
                                    : "text-bg-info"
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="small text-muted" style={{ maxWidth: 260 }}>
                              {u.delete_request_reason || (
                                <span className="text-muted fst-italic">No reason provided</span>
                              )}
                            </td>
                            <td>
                              <span className="badge rounded-pill text-bg-warning">
                                Pending
                              </span>
                            </td>
                            <td>
                              <div className="d-flex gap-2">
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => {
                                    setReviewTarget(u);
                                    setReviewAction("approve_delete_request");
                                    setReviewError(null);
                                  }}
                                >
                                  Approve &amp; Delete
                                </button>
                                <button
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => {
                                    setRejectReasonModal(u);
                                    setRejectReasonText("");
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── USER REPORT ACTION MODAL ───────────────────────────────── */}
      {userReportModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title">
                  {userReportAction === "deactivate"
                    ? "Deactivate Account"
                    : "Dismiss Reports"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setUserReportModal(null);
                    setUserReportAction("");
                    setUserReportNote("");
                    setUserReportError(null);
                  }}
                />
              </div>

              <div className="modal-body pt-3">
                {userReportError && (
                  <div className="alert alert-danger py-2">{userReportError}</div>
                )}

                <div className="mb-3">
                  <strong>User:</strong>{" "}
                  {userReportModal.reportedUser?.first_name}{" "}
                  {userReportModal.reportedUser?.last_name}{" "}
                  <span className="text-muted small">
                    ({userReportModal.reportedUser?.email})
                  </span>
                </div>

                <div className="mb-3">
                  <strong>Reports ({userReportModal.reports.length}):</strong>
                  <div className="mt-2 d-flex flex-column gap-2">
                    {userReportModal.reports.map((report) => (
                      <div
                        key={report.report_id}
                        className="bg-light rounded-3 p-3"
                      >
                        <div className="d-flex justify-content-between mb-1 flex-wrap gap-1">
                          <span className="small fw-medium">
                            By: {report.reported_by?.first_name}{" "}
                            {report.reported_by?.last_name}
                          </span>
                          <span className="badge text-bg-secondary small">
                            {report.reason}
                          </span>
                        </div>
                        {report.details && (
                          <div className="text-muted small">{report.details}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {userReportAction === "deactivate" && (
                  <div className="alert alert-warning py-2 small mb-3">
                    This will deactivate the account and notify the user and all reporters via message.
                  </div>
                )}

                <div>
                  <label className="form-label small fw-medium">
                    Admin note <span className="text-muted">(optional)</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder={
                      userReportAction === "deactivate"
                        ? "Reason for deactivation (sent to user and reporters)…"
                        : "Reason for dismissal (sent to reporters)…"
                    }
                    value={userReportNote}
                    onChange={(e) => setUserReportNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer border-0 pt-0">
                <button
                  className="btn btn-light"
                  onClick={() => {
                    setUserReportModal(null);
                    setUserReportAction("");
                    setUserReportNote("");
                    setUserReportError(null);
                  }}
                  disabled={userReportLoading}
                >
                  Cancel
                </button>
                <button
                  className={`btn ${
                    userReportAction === "deactivate"
                      ? "btn-danger"
                      : "btn-outline-secondary"
                  }`}
                  onClick={handleUserReportAction}
                  disabled={userReportLoading}
                >
                  {userReportLoading
                    ? "Processing…"
                    : userReportAction === "deactivate"
                    ? "Deactivate Account"
                    : "Dismiss Reports"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {reviewTarget && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title">Account Review</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setReviewTarget(null);
                    setReviewAction("");
                    setReviewError(null);
                  }}
                />
              </div>

              <div className="modal-body pt-3">
                {reviewError && <div className="alert alert-danger py-2">{reviewError}</div>}

                <div className="small text-muted mb-3">
                  Review the selected account action below.
                </div>

                <div className="mb-2"><strong>User:</strong> {reviewTarget.first_name} {reviewTarget.last_name}</div>
                <div className="mb-2"><strong>Role:</strong> {reviewTarget.role}</div>
                <div className="mb-2"><strong>Reports:</strong> {reviewTarget.report_count || 0}</div>
                <div className="mb-3"><strong>Deletion Requested:</strong> {reviewTarget.delete_requested ? "Yes" : "No"}</div>

                {reviewAction === "approve_delete_request" && (
                  <p className="mb-0 text-muted">
                    Approving this request will permanently delete the user and related data.
                  </p>
                )}

                {reviewAction === "deactivate" && (
                  <p className="mb-0 text-muted">
                    Deactivating this account will prevent further use of the platform.
                  </p>
                )}

                {reviewTarget.delete_requested && (
                  <div className="mt-3">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setRejectReasonModal(reviewTarget);
                        setRejectReasonText("");
                        setReviewTarget(null);
                      }}
                    >
                      Reject with Reason
                    </button>
                  </div>
                )}
              </div>

              <div className="modal-footer border-0 pt-0">
                <button
                  className="btn btn-light"
                  onClick={() => {
                    setReviewTarget(null);
                    setReviewAction("");
                    setReviewError(null);
                  }}
                  disabled={reviewLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleReviewAction}
                  disabled={reviewLoading}
                >
                  {reviewLoading ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectReasonModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title">Reject Deletion Request</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setRejectReasonModal(null);
                    setRejectReasonText("");
                  }}
                />
              </div>

              <div className="modal-body pt-3">
                <p className="text-muted mb-3">
                  Enter the reason that will be sent to{" "}
                  <strong>{rejectReasonModal.first_name} {rejectReasonModal.last_name}</strong>.
                </p>

                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Enter rejection reason"
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value)}
                />
              </div>

              <div className="modal-footer border-0 pt-0">
                <button
                  className="btn btn-light"
                  onClick={() => {
                    setRejectReasonModal(null);
                    setRejectReasonText("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  disabled={!rejectReasonText.trim()}
                  onClick={() => {
                    setReviewTarget(rejectReasonModal);
                    setReviewAction("reject_delete_request");
                    setReviewError(null);
                    handleReviewAction();
                  }}
                >
                  Send Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {listingReviewModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title">Review Listing Reports</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setListingReviewModal(null);
                    setListingReviewReason("");
                  }}
                />
              </div>

              <div className="modal-body pt-3">
                <div className="mb-3">
                  <strong>Listing:</strong> {listingReviewModal.listing.title}
                </div>

                <div className="mb-3">
                  {listingReviewModal.reports.length === 0 ? (
                    <p className="text-muted mb-0">No pending reports found.</p>
                  ) : (
                    listingReviewModal.reports.map((report) => (
                      <div
                        key={report.report_id}
                        className="border rounded-3 p-3 mb-2 bg-light-subtle"
                      >
                        <div className="mb-1">
                          <strong>Reported by:</strong>{" "}
                          {report.reported_by?.first_name} {report.reported_by?.last_name}
                        </div>
                        <div className="mb-1">
                          <strong>Reason:</strong> {report.reason}
                        </div>
                        <div className="mb-0">
                          <strong>Details:</strong>{" "}
                          {report.details || <span className="text-muted">—</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <label className="form-label">Admin decision note</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Write the decision note to send to reporting users"
                    value={listingReviewReason}
                    onChange={(e) => setListingReviewReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer border-0 pt-0">
                <button
                  className="btn btn-light"
                  onClick={() => {
                    setListingReviewModal(null);
                    setListingReviewReason("");
                  }}
                  disabled={listingReviewLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-outline-secondary"
                  disabled={!listingReviewReason.trim() || listingReviewLoading}
                  onClick={handleDismissListingReports}
                >
                  {listingReviewLoading ? "Sending..." : "Dismiss Reports"}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setDeleteTarget(listingReviewModal.listing);
                    setListingReviewModal(null);
                  }}
                >
                  Delete Listing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger">Delete Listing</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                />
              </div>

              <div className="modal-body pt-3">
                {deleteError && <div className="alert alert-danger py-2">{deleteError}</div>}
                <p className="mb-2">
                  Are you sure you want to permanently delete{" "}
                  <strong>&ldquo;{deleteTarget.title}&rdquo;</strong>?
                </p>
                <p className="text-muted small mb-0">
                  This will remove the listing and all related data from the database.
                </p>
              </div>

              <div className="modal-footer border-0 pt-0">
                <button
                  className="btn btn-light"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  disabled={deleting}
                  onClick={handleDeleteListing}
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}