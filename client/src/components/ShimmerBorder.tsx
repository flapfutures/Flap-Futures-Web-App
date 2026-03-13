import { ReactNode } from "react";

interface ShimmerBorderProps {
  children: ReactNode;
  borderRadius?: string;
  borderSize?: number;
  className?: string;
}

export default function ShimmerBorder({
  children,
  borderRadius = "0.5rem",
  borderSize = 2,
  className = "",
}: ShimmerBorderProps) {
  return (
    <div
      className={`shimmer-border-wrap ${className}`}
      style={{ borderRadius, padding: borderSize }}
    >
      {children}
    </div>
  );
}
