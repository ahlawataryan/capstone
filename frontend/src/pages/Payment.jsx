import Navbar from "../components/Navbar";

const mockPayments = [
  {
    payment_id: 1,
    booking_id: 101,
    job_title: "Dog Walking",
    client_name: "Gia Mort",
    student_name: "Will Smith",
    amount: 25,
    status: "Paid",
    created_at: "2026-04-10",
  },
  {
    payment_id: 2,
    booking_id: 102,
    job_title: "Lawn Care",
    client_name: "Milania Mort",
    student_name: "Theo V",
    amount: 40,
    status: "Unpaid",
    created_at: "2026-04-11",
  },
  {
    payment_id: 3,
    booking_id: 103,
    job_title: "Tutoring",
    client_name: "Enzo Mort",
    student_name: "Abby Lee Miller",
    amount: 30,
    status: "Failed",
    created_at: "2026-04-12",
  },
];

export default function Payment() {
  const userRole = "client"; // later replace with real logged-in role

  return (
    <>
      <Navbar />

      <div className="container py-4">
        <h2 className="mb-4">Payment History</h2>

        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title mb-3">Bookings Log</h5>

            {mockPayments.length === 0 ? (
              <p className="text-muted mb-0">No payment records yet.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {mockPayments.map((payment) => (
                  <div key={payment.payment_id} className="border rounded p-3">
                    <div className="d-flex justify-content-between flex-wrap gap-3">
                      <div>
                        <h6 className="mb-1">{payment.job_title}</h6>
                        <p className="mb-1 text-muted">
                          Student: {payment.student_name}
                        </p>
                        <p className="mb-1 text-muted">
                          Client: {payment.client_name}
                        </p>
                        <p className="mb-1 text-muted">
                          Amount: ${payment.amount}
                        </p>
                        <p className="mb-0 text-muted">
                          Created:{" "}
                          {new Date(payment.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-end">
                        {userRole === "client" ? (
                          <select
                            className="form-select"
                            defaultValue={payment.status}
                          >
                            <option value="Paid">Paid</option>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Failed">Failed</option>
                          </select>
                        ) : (
                          <span
                            className={`badge ${
                              payment.status === "Paid"
                                ? "bg-success"
                                : payment.status === "Unpaid"
                                ? "bg-warning text-dark"
                                : "bg-danger"
                            }`}
                          >
                            {payment.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
