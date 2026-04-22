import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Navbar from "../components/Navbar";
import {
  getUserByEmail,
  getPaymentsByClient,
  getPaymentsForStudent,
  updatePaymentStatus,
} from "../services/supabaseapi";

export default function Payment() {
  const { user } = useAuth0();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [dbUser, setDbUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPayments = async () => {
      if (!user?.email) return;

      setLoading(true);
      setError("");

      try {
        const { data: profile, error: profileError } = await getUserByEmail(user.email);
        if (profileError) throw profileError;

        setDbUser(profile);
        setUserRole(profile.role);

        if (profile.role === "client") {
          const result = await getPaymentsByClient(profile.user_id);
          if (result.error) throw result.error;
          setPayments(result.data || []);
        } else if (profile.role === "student") {
          const [asClient, asStudent] = await Promise.all([
            getPaymentsByClient(profile.user_id),
            getPaymentsForStudent(profile.user_id),
          ]);

          if (asClient.error) throw asClient.error;
          if (asStudent.error) throw asStudent.error;

          setPayments([
            ...(asClient.data || []),
            ...(asStudent.data || []),
          ]);
        } else {
          setPayments([]);
        }
      } catch (err) {
        console.error("Failed to load payments:", err);
        setError("Failed to load payment history.");
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, [user]);

  const handleStatusChange = async (paymentId, newStatus) => {
    try {
      const { error } = await updatePaymentStatus(paymentId, newStatus);
      if (error) throw error;

      setPayments((prev) =>
        prev.map((payment) =>
          payment.payment_id === paymentId
            ? { ...payment, status: newStatus }
            : payment
        )
      );
    } catch (err) {
      console.error("Failed to update payment status:", err);
      setError("Failed to update payment status.");
    }
  };

  const getBadgeClass = (status) => {
    if (status === "Paid") return "bg-success";
    if (status === "Unpaid") return "bg-warning text-dark";
    if (status === "Failed") return "bg-danger";
    return "bg-secondary";
  };

  return (
    <>
      <Navbar />

      <div className="container py-4">
        <h2 className="mb-4">Payment History</h2>

        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title mb-3">Bookings Log</h5>

            {loading ? (
              <p className="text-muted mb-0">Loading payments...</p>
            ) : error ? (
              <p className="text-danger mb-0">{error}</p>
            ) : payments.length === 0 ? (
              <p className="text-muted mb-0">No payment records yet.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {payments.map((payment) => {
                  const jobTitle =
                    payment.bookings?.listings?.title || "Untitled Job";

                  const studentName = payment.student
                    ? `${payment.student.first_name || ""} ${payment.student.last_name || ""}`.trim()
                    : "Unknown Student";

                  const clientName = payment.customer
                    ? `${payment.customer.first_name || ""} ${payment.customer.last_name || ""}`.trim()
                    : "Unknown Client";

                  return (
                    <div key={payment.payment_id} className="border rounded p-3">
                      <div className="d-flex justify-content-between flex-wrap gap-3">
                        <div>
                          <h6 className="mb-1">{jobTitle}</h6>
                          <p className="mb-1 text-muted">Student: {studentName}</p>
                          <p className="mb-1 text-muted">Client: {clientName}</p>
                          <p className="mb-1 text-muted">Amount: ${payment.amount}</p>
                          <p className="mb-1 text-muted">Provider: {payment.provider || "manual"}</p>
                          <p className="mb-0 text-muted">
                            Created: {new Date(payment.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="text-end">
                          {userRole === "student" ? (
                            <select
                              className="form-select"
                              value={payment.status}
                              onChange={(e) =>
                                handleStatusChange(payment.payment_id, e.target.value)
                              }
                            >
                              <option value="Paid">Paid</option>
                              <option value="Unpaid">Unpaid</option>
                              <option value="Failed">Failed</option>
                            </select>
                          ) : (
                            <span className={`badge ${getBadgeClass(payment.status)}`}>
                              {payment.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}