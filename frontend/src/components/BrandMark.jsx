export function BrandMark({ size = 36, className = "" }) {
  return (
    <span
      className={`brand-mark ${className}`.trim()}
      style={{ "--brand-mark-size": `${size}px` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M9 7.5h8.25a5.25 5.25 0 0 1 0 10.5H9V7.5Z" />
        <path d="M17 18l6 6.5" />
        <path d="M9 17.5v7" />
      </svg>
    </span>
  );
}
