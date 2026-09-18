import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const location = useLocation();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setSocket(null);
      return;
    }

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      upgrade: true,
      path: "/socket.io",
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(s);

    return () => {
      s.disconnect();
    };
    // Re-establish the connection whenever the route changes so a fresh
    // login/logout (which navigates without a full page reload) picks up
    // the current token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
