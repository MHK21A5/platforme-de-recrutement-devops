import { cn } from "../../lib/cn";

const VARIANT_CLASS = {
  default: "btn",
  outline: "btn btn-outline",
  secondary: "btn btn-secondary",
  ghost: "btn btn-ghost",
  destructive: "btn btn-destructive",
  brand: "btn btn-brand",
  link: "btn btn-link",
};

const SIZE_CLASS = {
  default: "",
  sm: "btn-sm",
  lg: "btn-lg",
  icon: "btn-icon",
};

export function Button({
  variant = "default",
  size = "default",
  block = false,
  className = "",
  type = "button",
  children,
  ...props
}) {
  const cls = cn(
    VARIANT_CLASS[variant] || VARIANT_CLASS.default,
    SIZE_CLASS[size] || "",
    block ? "btn-block" : "",
    className
  );
  return (
    <button type={type} className={cls} {...props}>
      {children}
    </button>
  );
}
