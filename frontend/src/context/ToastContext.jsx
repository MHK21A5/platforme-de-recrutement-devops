import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { CheckCircleIcon, AlertTriangleIcon, XIcon } from "../components/icons";

import { ToastContext } from "./useToast";

const ACCENTS = {
  success: "var(--success)",
  error: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
};

function ToastIcon({ type }) {
  if (type === "success") return <CheckCircleIcon size={16} style={{ color: ACCENTS.success }} />;
  if (type === "error" || type === "warning") return <AlertTriangleIcon size={16} style={{ color: ACCENTS[type] }} />;
  return <CheckCircleIcon size={16} style={{ color: ACCENTS.info }} />;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, type, message }]);
    const timer = setTimeout(() => dismiss(id), 4000);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (msg) => push("success", msg),
    error: (msg) => push("error", msg),
    warning: (msg) => push("warning", msg),
    info: (msg) => push("info", msg),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={S.container}>
        <AnimatePresence>
          {toasts.map((t) => (
            <Motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{ ...S.toast, borderLeft: `3px solid ${ACCENTS[t.type] || ACCENTS.info}` }}
              onClick={() => dismiss(t.id)}
            >
              <ToastIcon type={t.type} />
              <span style={S.message}>{t.message}</span>
              <button
                type="button"
                aria-label="Dismiss"
                style={S.closeBtn}
                onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              >
                <XIcon size={13} />
              </button>
            </Motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}


const S = {
  container: {
    position: "fixed", bottom: 20, right: 20, zIndex: 9999,
    display: "flex", flexDirection: "column", gap: 10,
    maxWidth: 360, pointerEvents: "none",
  },
  toast: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "12px 14px", borderRadius: "var(--radius)",
    background: "var(--bg-card)", boxShadow: "var(--shadow-lg)",
    border: "1px solid var(--border)", cursor: "pointer",
    pointerEvents: "auto",
  },
  message: {
    flex: 1, fontSize: "0.85rem", lineHeight: 1.4, color: "var(--fg)",
    wordBreak: "break-word",
  },
  closeBtn: {
    background: "transparent", border: "none", cursor: "pointer",
    color: "var(--fg-subtle)", flexShrink: 0, padding: 2, display: "flex",
  },
};
