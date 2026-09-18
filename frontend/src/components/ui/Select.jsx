import { forwardRef } from "react";
import { cn } from "../../lib/cn";

export const Select = forwardRef(function Select(
  { className = "", children, ...props },
  ref
) {
  return (
    <select ref={ref} className={cn("select", className)} {...props}>
      {children}
    </select>
  );
});
