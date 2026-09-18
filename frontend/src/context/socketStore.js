import { io } from "socket.io-client";

// The socket is an external resource; expose its lifecycle through a store.
export function createSocketStore() {
  let socket = null;
  const listeners = new Set();
  const publish = (next) => {
    socket = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => socket,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect(token) {
      if (!token) return;
      const connection = io("http://localhost:5000", {
        auth: { token },
        transports: ["websocket", "polling"],
        upgrade: true,
        path: "/socket.io",
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      publish(connection);
      return () => {
        connection.disconnect();
        publish(null);
      };
    },
  };
}
