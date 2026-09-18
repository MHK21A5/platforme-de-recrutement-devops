import { cn } from "../../lib/cn";

export function Separator({ className = "", orientation = "horizontal", ...props }) {
  const base = orientation === "vertical" ? "sep-v" : "separator";
  return <div role="separator" className={cn(base, className)} {...props} />;
}
