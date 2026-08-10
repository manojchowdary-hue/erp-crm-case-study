import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const linkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: "8px",
    textDecoration: "none",
    color: isActive ? "#fff" : "#334155",
    background: isActive ? "#2563eb" : "transparent",
    fontWeight: 600,
    fontSize: "14px",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <strong style={{ fontSize: "16px", color: "#0f172a" }}>ERP + CRM Portal</strong>
          <nav style={{ display: "flex", gap: "6px" }}>
            <NavLink to="/customers" style={linkStyle}>Customers</NavLink>
            <NavLink to="/products" style={linkStyle}>Products</NavLink>
            <NavLink to="/challans" style={linkStyle}>Challans</NavLink>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            {user?.name} · <strong>{user?.role}</strong>
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main style={{ padding: "24px" }}>
        <Outlet />
      </main>
    </div>
  );
}
