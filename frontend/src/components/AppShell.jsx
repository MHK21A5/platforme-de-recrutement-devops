import { useNavigate } from "react-router-dom";
import { useTheme } from "../lib/useTheme";
import { Button } from "./ui/Button";
import { LogOutIcon, SettingsIcon } from "./icons";
import { NotificationBell } from "./NotificationBell";

const LOGO_URL = "http://localhost:5000/uploads/logo.png";
const BASE_URL = "http://localhost:5000";

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

function roleLabel(role) {
  if (role === "admin") return "Administrator";
  if (role === "recruiter") return "Recruiter";
  if (role === "candidate") return "Candidate";
  return role || "User";
}

export function Avatar({ name, profileImage, size = 32, style = {}, className = "" }) {
  const imgSrc = profileImage
    ? profileImage.startsWith("http") ? profileImage : `${BASE_URL}${profileImage}`
    : null;

  const base = {
    width: size, height: size, borderRadius: "9999px",
    background: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
    color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: Math.max(10, size * 0.33), fontWeight: 700, flexShrink: 0, overflow: "hidden",
    ...style,
  };

  if (imgSrc) {
    return (
      <span className={`avatar ${className}`} style={{ ...base, background: "none" }}>
        <img src={imgSrc} alt={name || "avatar"} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "9999px" }} />
      </span>
    );
  }
  return <span className={`avatar ${className}`} style={base}>{initials(name)}</span>;
}

export function AppShell({ user, title, subtitle, topbarActions, children, nav = [], activeKey, onNav }) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className={`app-shell ${isDark ? "theme-dark" : "theme-light"}`}>
      <aside className="app-sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">
            <img src={LOGO_URL} alt="STB" style={{ width: 32, height: 32, objectFit: "contain", display: "block" }} />
          </span>
          <span className="sidebar-brand-text">STB Recruitment</span>
        </div>

        {/* Nav */}
        <div className="sidebar-section-label">Main</div>
        {nav.map((item) => (
          <button
            key={item.key}
            className={`sidebar-link${item.key === activeKey ? " active" : ""}`}
            onClick={() => { if (item.href) navigate(item.href); else onNav?.(item.key); }}
            type="button"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        {/* Account */}
        <div className="sidebar-section-label">Account</div>
        <button
          className="sidebar-link"
          type="button"
          onClick={toggle}
          style={{ justifyContent: "space-between" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <SettingsIcon size={16} />
            <span>Appearance</span>
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 9999, fontSize: "0.7rem", fontWeight: 600,
            background: isDark ? "rgba(59,130,246,0.18)" : "rgba(0,0,0,0.07)",
            color: isDark ? "var(--brand)" : "var(--fg-muted)",
            border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "rgba(0,0,0,0.1)"}`,
          }}>
            {isDark ? <MoonIcon /> : <SunIcon />}
            {isDark ? "Dark" : "Light"}
          </span>
        </button>

        <button className="sidebar-link" type="button" onClick={handleLogout}>
          <LogOutIcon size={16} />
          <span>Log out</span>
        </button>

        {/* User chip */}
        <div className="sidebar-footer">
          <div className="user-chip">
            <Avatar name={user?.name} profileImage={user?.profileImage} size={32} />
            <div className="user-chip-info">
              <span className="user-chip-name">{user?.name || "User"}</span>
              <span className="user-chip-email">{user?.email || roleLabel(user?.role)}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="app-main">
        {/* Topbar */}
        <div className="app-topbar">
          <div>
            <div className="topbar-title">{title}</div>
            {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {topbarActions}
            <NotificationBell />
            <button
              onClick={toggle}
              title={isDark ? "Switch to light" : "Switch to dark"}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: 9999, cursor: "pointer",
                background: "transparent", border: "1px solid var(--border-hi)",
                color: "var(--fg-muted)", transition: "all 150ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "var(--fg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-muted)"; }}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOutIcon size={14} />
              Logout
            </Button>
          </div>
        </div>

        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
