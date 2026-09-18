import { createContext, useContext } from "react";

export const NotificationContext = createContext(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return { notifications: [], unreadCount: 0, markAsRead() {}, markAllAsRead() {} };
  }
  return ctx;
}
