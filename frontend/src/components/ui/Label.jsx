import { cn } from "../../lib/cn";

export function Label({ className = "", children, ...props }) {
  return (
    <label className={cn("label", className)} {...props}>
      {children}
    </label>
  );
}
