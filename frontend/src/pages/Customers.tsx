import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { ui, badge } from "../components/ui";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  businessName?: string;
  customerType: string;
  status: string;
  createdAt: string;
}

const statusColors: Record<string, [string, string]> = {
  LEAD: ["#fef3c7", "#92400e"],
  ACTIVE: ["#dcfce7", "#166534"],
  INACTIVE: ["#f1f5f9", "#475569"],
};

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/customers", { params: { search: search || undefined, status: status || undefined } });
      setItems(res.data.items);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  return (
    <div style={ui.page}>
      <div style={ui.headerRow}>
        <h1 style={ui.h1}>Customers</h1>
        <button style={ui.button} onClick={() => setShowModal(true)}>+ Add Customer</button>
      </div>

      {error && <div style={ui.errorBox}>{error}</div>}

      <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
        <input
          style={ui.input}
          placeholder="Search name, mobile, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={ui.select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div style={ui.card}>
        {loading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "13px" }}>No customers found.</p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Name</th>
                <th style={ui.th}>Business</th>
                <th style={ui.th}>Mobile</th>
                <th style={ui.th}>Type</th>
                <th style={ui.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td style={ui.td}>
                    <Link to={`/customers/${c.id}`} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                      {c.name}
                    </Link>
                  </td>
                  <td style={ui.td}>{c.businessName || "—"}</td>
                  <td style={ui.td}>{c.mobile}</td>
                  <td style={ui.td}>{c.customerType}</td>
                  <td style={ui.td}>
                    <span style={badge(...(statusColors[c.status] || ["#f1f5f9", "#475569"]))}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AddCustomerModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    businessName: "",
    customerType: "RETAIL",
    status: "LEAD",
    address: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/customers", form);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={ui.modalOverlay} onClick={onClose}>
      <form style={ui.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 style={{ margin: 0, fontSize: "16px" }}>Add Customer</h2>
        {error && <div style={{ ...ui.errorBox, marginTop: "12px" }}>{error}</div>}

        <label style={ui.label}>Name *</label>
        <input style={{ ...ui.input, width: "100%" }} required value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <label style={ui.label}>Mobile *</label>
        <input style={{ ...ui.input, width: "100%" }} required value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })} />

        <label style={ui.label}>Email</label>
        <input style={{ ...ui.input, width: "100%" }} type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label style={ui.label}>Business Name</label>
        <input style={{ ...ui.input, width: "100%" }} value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })} />

        <label style={ui.label}>Customer Type</label>
        <select style={{ ...ui.select, width: "100%" }} value={form.customerType}
          onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
          <option value="DISTRIBUTOR">Distributor</option>
        </select>

        <label style={ui.label}>Status</label>
        <select style={{ ...ui.select, width: "100%" }} value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <label style={ui.label}>Address</label>
        <input style={{ ...ui.input, width: "100%" }} value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })} />

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button type="button" style={ui.buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" style={ui.button} disabled={saving}>{saving ? "Saving..." : "Save Customer"}</button>
        </div>
      </form>
    </div>
  );
}
