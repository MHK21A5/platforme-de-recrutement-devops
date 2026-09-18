import { createContext, useContext } from "react";

export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so components never crash if rendered outside the provider.
    return { success() {}, error() {}, warning() {}, info() {} };
  }
  return ctx;
}
