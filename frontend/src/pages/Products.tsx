import { FormEvent, useEffect, useState } from "react";
import api from "../api/client";
import { ui, badge } from "../components/ui";

interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unitPrice: number;
  currentStock: number;
  minStockAlert: number;
  location?: string;
}

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/products", { params: { search: search || undefined } });
      setItems(res.data.items);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div style={ui.page}>
      <div style={ui.headerRow}>
        <h1 style={ui.h1}>Products & Inventory</h1>
        <button style={ui.button} onClick={() => setShowAdd(true)}>+ Add Product</button>
      </div>

      {error && <div style={ui.errorBox}>{error}</div>}

      <input
        style={{ ...ui.input, marginBottom: "14px" }}
        placeholder="Search name, SKU, category..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={ui.card}>
        {loading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "13px" }}>No products found.</p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Name</th>
                <th style={ui.th}>SKU</th>
                <th style={ui.th}>Category</th>
                <th style={ui.th}>Price</th>
                <th style={ui.th}>Stock</th>
                <th style={ui.th}>Location</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const low = p.currentStock <= p.minStockAlert;
                return (
                  <tr key={p.id}>
                    <td style={ui.td}>{p.name}</td>
                    <td style={ui.td}>{p.sku}</td>
                    <td style={ui.td}>{p.category || "—"}</td>
                    <td style={ui.td}>₹{Number(p.unitPrice).toFixed(2)}</td>
                    <td style={ui.td}>
                      {p.currentStock}
                      {low && <span style={{ ...badge("#fee2e2", "#b91c1c"), marginLeft: "6px" }}>LOW</span>}
                    </td>
                    <td style={ui.td}>{p.location || "—"}</td>
                    <td style={ui.td}>
                      <button style={ui.buttonSecondary} onClick={() => setStockModalProduct(p)}>Adjust Stock</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddProductModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />
      )}
      {stockModalProduct && (
        <StockModal
          product={stockModalProduct}
          onClose={() => setStockModalProduct(null)}
          onSaved={() => { setStockModalProduct(null); load(); }}
        />
      )}
    </div>
  );
}

function AddProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", sku: "", category: "", unitPrice: "", currentStock: "0", minStockAlert: "0", location: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/products", {
        ...form,
        unitPrice: parseFloat(form.unitPrice) || 0,
        currentStock: parseInt(form.currentStock) || 0,
        minStockAlert: parseInt(form.minStockAlert) || 0,
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={ui.modalOverlay} onClick={onClose}>
      <form style={ui.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 style={{ margin: 0, fontSize: "16px" }}>Add Product</h2>
        {error && <div style={{ ...ui.errorBox, marginTop: "12px" }}>{error}</div>}

        <label style={ui.label}>Name *</label>
        <input style={{ ...ui.input, width: "100%" }} required value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <label style={ui.label}>SKU *</label>
        <input style={{ ...ui.input, width: "100%" }} required value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })} />

        <label style={ui.label}>Category</label>
        <input style={{ ...ui.input, width: "100%" }} value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })} />

        <label style={ui.label}>Unit Price *</label>
        <input style={{ ...ui.input, width: "100%" }} required type="number" step="0.01" value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />

        <label style={ui.label}>Opening Stock</label>
        <input style={{ ...ui.input, width: "100%" }} type="number" value={form.currentStock}
          onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />

        <label style={ui.label}>Minimum Stock Alert</label>
        <input style={{ ...ui.input, width: "100%" }} type="number" value={form.minStockAlert}
          onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })} />

        <label style={ui.label}>Location / Warehouse</label>
        <input style={{ ...ui.input, width: "100%" }} value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })} />

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button type="button" style={ui.buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" style={ui.button} disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
        </div>
      </form>
    </div>
  );
}

function StockModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post(`/products/${product.id}/stock-movements`, {
        quantityChanged: parseInt(quantity) || 0,
        movementType,
        reason,
      });
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={ui.modalOverlay} onClick={onClose}>
      <form style={ui.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 style={{ margin: 0, fontSize: "16px" }}>Adjust Stock — {product.name}</h2>
        <p style={{ fontSize: "12px", color: "#64748b" }}>Current stock: {product.currentStock}</p>
        {error && <div style={{ ...ui.errorBox, marginTop: "12px" }}>{error}</div>}

        <label style={ui.label}>Movement Type</label>
        <select style={{ ...ui.select, width: "100%" }} value={movementType} onChange={(e) => setMovementType(e.target.value as any)}>
          <option value="IN">IN (stock received)</option>
          <option value="OUT">OUT (stock removed)</option>
        </select>

        <label style={ui.label}>Quantity *</label>
        <input style={{ ...ui.input, width: "100%" }} required type="number" min="1" value={quantity}
          onChange={(e) => setQuantity(e.target.value)} />

        <label style={ui.label}>Reason</label>
        <input style={{ ...ui.input, width: "100%" }} placeholder="e.g. Purchase order received"
          value={reason} onChange={(e) => setReason(e.target.value)} />

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button type="button" style={ui.buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" style={ui.button} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
