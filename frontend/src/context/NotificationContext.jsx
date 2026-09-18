import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useSocket } from "./useSocket";
import { useToast } from "./useToast";

import { NotificationContext } from "./useNotifications";

export function NotificationProvider({ children }) {
  const socket = useSocket();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const token = localStorage.getItem("token");
  const [previousToken, setPreviousToken] = useState(token);
  if (previousToken !== token) {
    setPreviousToken(token);
    setNotifications([]);
    setUnreadCount(0);
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    api.get("/notifications").then((res) => {
      if (!active) return;
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    }).catch(() => {
      if (!active) return;
      setNotifications([]);
      setUnreadCount(0);
    });
    return () => { active = false; };
  }, [token, socket]);

  useEffect(() => {
    if (!socket) return;

    const onNew = (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      toast.info(notification.title + (notification.message ? ` — ${notification.message}` : ""));
    };

    socket.on("notification:new", onNew);
    return () => socket.off("notification:new", onNew);
  }, [socket, toast]);

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
