// Tiny classname combiner. Filters out falsy values.
export function cn(...args) {
  return args.filter(Boolean).join(" ");
}
