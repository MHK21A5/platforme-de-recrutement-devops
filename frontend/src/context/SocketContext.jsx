import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { SocketContext } from "./useSocket";
import { createSocketStore } from "./socketStore";

export function SocketProvider({ children }) {
  const location = useLocation();
  const [store] = useState(createSocketStore);
  const socket = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    // Route changes pick up login/logout without remounting descendants.
    return store.connect(localStorage.getItem("token"));
  }, [location.pathname, store]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
