import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { useSocket } from "./SocketContext";
import { useToast } from "./ToastContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const socket = useSocket();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Re-fetch whenever the shared socket (re)connects — this happens right
    // after login/logout since SocketContext reconnects on route change,
    // which is the only reliable signal that the auth token just changed.
  }, [loadNotifications, socket]);

  useEffect(() => {
    if (!socket) return;

    const onNew = (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      toast.info(notification.title + (notification.message ? ` — ${notification.message}` : ""));
    };

    socket.on("notification:new", onNew);
    return () => socket.off("notification:new", onNew);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const markAsRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // best-effort — local state already updated
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.patch("/notifications/read-all");
    } catch {
      // best-effort — local state already updated
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return { notifications: [], unreadCount: 0, markAsRead() {}, markAllAsRead() {} };
  }
  return ctx;
}
