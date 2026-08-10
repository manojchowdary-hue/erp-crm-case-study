import { FormEvent, useEffect, useState } from "react";
import api from "../api/client";
import { ui, badge } from "../components/ui";

const statusColors: Record<string, [string, string]> = {
  DRAFT: ["#fef3c7", "#92400e"],
  CONFIRMED: ["#dcfce7", "#166534"],
  CANCELLED: ["#f1f5f9", "#475569"],
};

export default function Challans() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/challans");
      setItems(res.data.items);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load challans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmChallan(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api.put(`/challans/${id}/confirm`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to confirm challan");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelChallan(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api.put(`/challans/${id}/cancel`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to cancel challan");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={ui.page}>
      <div style={ui.headerRow}>
        <h1 style={ui.h1}>Sales Challans</h1>
        <button style={ui.button} onClick={() => setShowCreate(true)}>+ New Challan</button>
      </div>

      {error && <div style={ui.errorBox}>{error}</div>}

      <div style={ui.card}>
        {loading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "13px" }}>No challans yet.</p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Challan #</th>
                <th style={ui.th}>Customer</th>
                <th style={ui.th}>Items</th>
                <th style={ui.th}>Total Qty</th>
                <th style={ui.th}>Status</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td style={ui.td}>{c.challanNumber}</td>
                  <td style={ui.td}>{c.customer?.name}</td>
                  <td style={ui.td}>{c.items?.length}</td>
                  <td style={ui.td}>{c.totalQuantity}</td>
                  <td style={ui.td}>
                    <span style={badge(...(statusColors[c.status] || ["#f1f5f9", "#475569"]))}>{c.status}</span>
                  </td>
                  <td style={ui.td}>
                    {c.status === "DRAFT" && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button style={ui.buttonSecondary} disabled={busyId === c.id} onClick={() => confirmChallan(c.id)}>
                          Confirm
                        </button>
                        <button style={ui.buttonDanger} disabled={busyId === c.id} onClick={() => cancelChallan(c.id)}>
                          Cancel
                        </button>
                      </div>
                    )}
                    {c.status === "CONFIRMED" && (
                      <button style={ui.buttonDanger} disabled={busyId === c.id} onClick={() => cancelChallan(c.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateChallanModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

function CreateChallanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<{ productId: string; quantity: string }[]>([{ productId: "", quantity: "1" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers", { params: { pageSize: 100 } }).then((r) => setCustomers(r.data.items));
    api.get("/products", { params: { pageSize: 100 } }).then((r) => setProducts(r.data.items));
  }, []);

  function updateLine(idx: number, field: "productId" | "quantity", value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: "1" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(status: "DRAFT" | "CONFIRMED", e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const items = lines
        .filter((l) => l.productId && parseInt(l.quantity) > 0)
        .map((l) => ({ productId: l.productId, quantity: parseInt(l.quantity) }));
      if (!customerId || items.length === 0) {
        setError("Select a customer and at least one product line.");
        setSaving(false);
        return;
      }
      await api.post("/challans", { customerId, items, status });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create challan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={ui.modalOverlay} onClick={onClose}>
      <form style={{ ...ui.modal, width: "560px" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: "16px" }}>New Sales Challan</h2>
        {error && <div style={{ ...ui.errorBox, marginTop: "12px" }}>{error}</div>}

        <label style={ui.label}>Customer *</label>
        <select style={{ ...ui.select, width: "100%" }} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select customer...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} {c.businessName ? `(${c.businessName})` : ""}</option>
          ))}
        </select>

        <label style={ui.label}>Products</label>
        {lines.map((line, idx) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <select
              style={{ ...ui.select, flex: 2 }}
              value={line.productId}
              onChange={(e) => updateLine(idx, "productId", e.target.value)}
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — stock: {p.currentStock}</option>
              ))}
            </select>
            <input
              style={{ ...ui.input, width: "80px" }}
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) => updateLine(idx, "quantity", e.target.value)}
            />
            <button type="button" style={ui.buttonDanger} onClick={() => removeLine(idx)}>✕</button>
          </div>
        ))}
        <button type="button" style={ui.buttonSecondary} onClick={addLine}>+ Add Product Line</button>

        <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
          <button type="button" style={ui.buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="button" style={ui.buttonSecondary} disabled={saving} onClick={(e) => submit("DRAFT", e)}>
            Save as Draft
          </button>
          <button type="button" style={ui.button} disabled={saving} onClick={(e) => submit("CONFIRMED", e)}>
            {saving ? "Saving..." : "Save & Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
