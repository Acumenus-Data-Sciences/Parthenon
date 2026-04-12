import type { ReactNode } from "react";
import type { AresSection } from "../../types/ares";

interface HubCardProps {
  section: AresSection;
  title: string;
  accentColor: string;
  children: ReactNode;
  onClick: (section: AresSection) => void;
}

export function HubCard({ section, title, accentColor, children, onClick }: HubCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(section)}
      className="group flex flex-col items-start gap-3 rounded-xl border border-[#252530] bg-[#151518] p-5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[#1a1a22]"
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#C5C0B8]">
          {title}
        </span>
      </div>
      <div className="text-sm text-[#8A857D]">{children}</div>
    </button>
  );
}
