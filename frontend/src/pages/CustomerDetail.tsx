import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import { ui } from "../components/ui";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    try {
      await api.post(`/customers/${id}/notes`, { note });
      setNote("");
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add note");
    }
  }

  if (loading) return <div style={ui.page}>Loading...</div>;
  if (!customer) return <div style={ui.page}>{error || "Not found"}</div>;

  return (
    <div style={ui.page}>
      <Link to="/customers" style={{ fontSize: "13px", color: "#2563eb", textDecoration: "none" }}>← Back to Customers</Link>
      <div style={{ ...ui.headerRow, marginTop: "10px" }}>
        <h1 style={ui.h1}>{customer.name}</h1>
      </div>

      {error && <div style={ui.errorBox}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={ui.card}>
          <h3 style={{ marginTop: 0, fontSize: "14px" }}>Details</h3>
          <p style={{ fontSize: "13px" }}><strong>Mobile:</strong> {customer.mobile}</p>
          <p style={{ fontSize: "13px" }}><strong>Email:</strong> {customer.email || "—"}</p>
          <p style={{ fontSize: "13px" }}><strong>Business:</strong> {customer.businessName || "—"}</p>
          <p style={{ fontSize: "13px" }}><strong>GST:</strong> {customer.gstNumber || "—"}</p>
          <p style={{ fontSize: "13px" }}><strong>Type:</strong> {customer.customerType}</p>
          <p style={{ fontSize: "13px" }}><strong>Status:</strong> {customer.status}</p>
          <p style={{ fontSize: "13px" }}><strong>Address:</strong> {customer.address || "—"}</p>
        </div>

        <div style={ui.card}>
          <h3 style={{ marginTop: 0, fontSize: "14px" }}>Follow-up Notes</h3>
          <form onSubmit={addNote} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <input
              style={{ ...ui.input, flex: 1 }}
              placeholder="Add a follow-up note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button style={ui.button} type="submit">Add</button>
          </form>
          {customer.notes?.length ? (
            customer.notes.map((n: any) => (
              <div key={n.id} style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 0", fontSize: "13px" }}>
                <div>{n.note}</div>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: "#64748b", fontSize: "13px" }}>No notes yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
