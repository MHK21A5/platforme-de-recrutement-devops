import { useNavigate } from "react-router-dom";
import { useTheme } from "../lib/useTheme";
import { Button } from "./ui/Button";
import { LogOutIcon, SettingsIcon } from "./icons";
import { NotificationBell } from "./NotificationBell";
import { BrandMark } from "./BrandMark";

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
  const imgSrc = profileImage || null;

  const base = {
    width: size, height: size, borderRadius: "9999px",
    background: "linear-gradient(135deg,#D6AE3F,#F0D276)",
    color: "#17120A", display: "inline-flex", alignItems: "center", justifyContent: "center",
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

  const handleNav = (item) => {
    if (item.href) navigate(item.href);
    else onNav?.(item.key);
  };

  return (
    <div className={`app-shell ${isDark ? "theme-dark" : "theme-light"}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <BrandMark size={38} />
          <span className="sidebar-brand-copy">
            <span className="sidebar-brand-text">Recruitment App</span>
            <span className="sidebar-brand-tagline">Hiring workspace</span>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <div className="sidebar-section-label">Workspace</div>
          {nav.map((item) => (
            <button
              key={item.key}
              className={`sidebar-link${item.key === activeKey ? " active" : ""}`}
              onClick={() => handleNav(item)}
              type="button"
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-section-label">Account</div>
        <button
          className="sidebar-link"
          type="button"
          onClick={toggle}
          style={{ justifyContent: "space-between" }}
        >
          <span className="sidebar-link-content">
            <span className="sidebar-link-icon"><SettingsIcon size={16} /></span>
            <span>Appearance</span>
          </span>
          <span className="theme-pill">
            {isDark ? <MoonIcon /> : <SunIcon />}
            {isDark ? "Dark" : "Light"}
          </span>
        </button>

        <button className="sidebar-link" type="button" onClick={handleLogout}>
          <span className="sidebar-link-icon"><LogOutIcon size={16} /></span>
          <span>Log out</span>
        </button>

        <div className="sidebar-footer">
          <div className="user-chip">
            <Avatar name={user?.name} profileImage={user?.profileImage} size={32} />
            <div className="user-chip-info">
              <span className="user-chip-name">{user?.name || "User"}</span>
              <span className="user-chip-email">{roleLabel(user?.role)}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-topbar">
          <div className="topbar-heading">
            <span className="topbar-mobile-brand"><BrandMark size={34} /></span>
            <div>
              <div className="topbar-title">{title}</div>
              {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
            </div>
          </div>
          <div className="topbar-actions">
            {topbarActions}
            <NotificationBell />
            <button
              onClick={toggle}
              title={isDark ? "Switch to light" : "Switch to dark"}
              className="icon-button"
              type="button"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="topbar-logout">
              <LogOutIcon size={14} />
              Logout
            </Button>
          </div>
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {nav.map((item) => (
            <button
              key={item.key}
              className={`mobile-nav-link${item.key === activeKey ? " active" : ""}`}
              onClick={() => handleNav(item)}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
