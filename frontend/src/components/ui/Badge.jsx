import { cn } from "../../lib/cn";

const VARIANT = {
  default: "badge-default",
  secondary: "badge-secondary",
  outline: "badge-outline",
  success: "badge-success",
  warning: "badge-warning",
  destructive: "badge-destructive",
  info: "badge-info",
  brand: "badge-brand",
};

export function Badge({ variant = "secondary", className = "", children, ...props }) {
  return (
    <span className={cn("badge", VARIANT[variant] || VARIANT.secondary, className)} {...props}>
      {children}
    </span>
  );
}
