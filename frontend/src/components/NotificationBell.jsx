import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { BellIcon } from "./icons";
import { Button } from "./ui/Button";
import { useNotifications } from "../context/useNotifications";

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleClick = (n) => {
    if (!n.read) markAsRead(n._id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  // Opens the existing prefilled scheduling form in the Applications tab.
  // It never creates the interview — the recruiter still picks a date and confirms.
  const handleCreateInterview = (e, n) => {
    e.stopPropagation();
    if (!n.read) markAsRead(n._id);
    setOpen(false);
    navigate(`/dashboard?tab=applications&application=${n.relatedId}`);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label="Notifications"
        style={S.bellBtn}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "var(--fg)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-muted)"; }}
      >
        <BellIcon size={16} />
        {unreadCount > 0 && (
          <span style={S.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <Motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={S.panel}
          >
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>Notifications</span>
              {unreadCount > 0 && (
                <button style={S.markAllBtn} onClick={markAllAsRead}>Mark all read</button>
              )}
            </div>

            <div style={S.list}>
              {notifications.length === 0 && (
                <div style={S.empty}>No notifications yet.</div>
              )}
              {notifications.map((n, i) => (
                <Motion.div
                  key={n._id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(i, 6) * 0.03 }}
                  style={{ ...S.item, background: n.read ? "transparent" : "var(--brand-dim)" }}
                  onClick={() => handleClick(n)}
                >
                  {!n.read && <span style={S.dot} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.itemTitle}>{n.title}</div>
                    {n.message && <div style={S.itemMessage}>{n.message}</div>}
                    <div style={S.itemTime}>{timeAgo(n.createdAt)}</div>
                    {n.canCreateInterview && (
                      <div style={S.itemActions}>
                        <Button
                          variant="brand"
                          size="sm"
                          onClick={(e) => handleCreateInterview(e, n)}
                        >
                          Create Interview
                        </Button>
                      </div>
                    )}
                  </div>
                </Motion.div>
              ))}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const S = {
  bellBtn: {
    position: "relative",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 9999, cursor: "pointer",
    background: "transparent", border: "1px solid var(--border-hi)",
    color: "var(--fg-muted)", transition: "all 150ms",
  },
  badge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 16, height: 16, padding: "0 3px", borderRadius: 9999,
    background: "var(--danger)", color: "#fff", fontSize: "0.62rem", fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
  },
  panel: {
    position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340,
    maxHeight: 420, display: "flex", flexDirection: "column", overflow: "hidden",
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", zIndex: 50,
  },
  panelHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0,
  },
  panelTitle: { fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" },
  markAllBtn: {
    background: "transparent", border: "none", cursor: "pointer",
    color: "var(--brand)", fontSize: "0.75rem", fontWeight: 600,
  },
  list: { overflowY: "auto", flex: 1 },
  empty: { padding: "24px 14px", textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.82rem" },
  item: {
    display: "flex", alignItems: "flex-start", gap: 8,
    padding: "10px 14px", borderBottom: "1px solid var(--border)",
    cursor: "pointer", transition: "background 120ms",
  },
  dot: { width: 6, height: 6, borderRadius: 9999, background: "var(--brand)", marginTop: 6, flexShrink: 0 },
  itemTitle: { fontSize: "0.82rem", fontWeight: 600, color: "var(--fg)" },
  itemMessage: { fontSize: "0.78rem", color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.4 },
  itemTime: { fontSize: "0.68rem", color: "var(--fg-subtle)", marginTop: 4 },
  itemActions: { marginTop: 8 },
};
