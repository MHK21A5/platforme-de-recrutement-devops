import { useRef } from "react";
import { motion as Motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Wraps children in a card that tilts toward the cursor on hover (CSS 3D
 * transform via framer-motion springs) and lifts its shadow. Pure CSS/JS —
 * no WebGL, no new dependency.
 */
export function TiltCard({ children, style = {}, className = "", maxTilt = 6, onClick }) {
  const ref = useRef(null);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 220, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 220, damping: 20 });
  const shadow = useTransform(
    [springX, springY],
    ([rx, ry]) => {
      const intensity = (Math.abs(rx) + Math.abs(ry)) / (maxTilt * 2);
      return `0 ${8 + intensity * 20}px ${20 + intensity * 30}px rgba(0,0,0,${0.12 + intensity * 0.18})`;
    }
  );

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * maxTilt * 2);
    rotateX.set(-(py - 0.5) * maxTilt * 2);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <Motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        rotateX: springX,
        rotateY: springY,
        boxShadow: shadow,
        transformPerspective: 900,
        transformStyle: "preserve-3d",
        willChange: "transform",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </Motion.div>
  );
}
