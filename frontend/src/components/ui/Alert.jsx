import { cn } from "../../lib/cn";

const VARIANT = {
  success: "alert-success",
  destructive: "alert-destructive",
  info: "alert-info",
};

export function Alert({ variant = "info", className = "", children, ...props }) {
  return (
    <div className={cn("alert", VARIANT[variant] || VARIANT.info, className)} {...props}>
      {children}
    </div>
  );
}

export function AlertTitle({ className = "", children, ...props }) {
  return (
    <div className={cn("alert-title", className)} {...props}>
      {children}
    </div>
  );
}

export function AlertDescription({ className = "", children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
