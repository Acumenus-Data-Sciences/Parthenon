import type { SVGProps } from "react";

export function ParthenonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Pediment (triangular roof) */}
      <path d="M3 9L12 3L21 9" />
      {/* Entablature (beam under roof) */}
      <line x1="2" y1="9" x2="22" y2="9" />
      {/* Columns */}
      <line x1="5" y1="9" x2="5" y2="19" />
      <line x1="9" y1="9" x2="9" y2="19" />
      <line x1="15" y1="9" x2="15" y2="19" />
      <line x1="19" y1="9" x2="19" y2="19" />
      {/* Stylobate (base) */}
      <line x1="2" y1="19" x2="22" y2="19" />
      <line x1="1" y1="21" x2="23" y2="21" />
    </svg>
  );
}
