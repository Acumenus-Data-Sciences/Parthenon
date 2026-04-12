import { useState } from "react";
import type { CrossLinksMap } from "../../types";

interface CrossLinkBadgeProps {
  pinId: number;
  crossLinks: CrossLinksMap;
}

export function CrossLinkBadge({ pinId, crossLinks }: CrossLinkBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const links = crossLinks[pinId];
  if (!links || links.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border transition-colors"
        style={{
          backgroundColor: "rgba(45, 212, 191, 0.1)",
          borderColor: "rgba(45, 212, 191, 0.3)",
          color: "#2DD4BF",
        }}
      >
        <span>🔗</span>
        <span>{links.length} link{links.length !== 1 ? "s" : ""}</span>
      </button>

      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 mb-2 z-50 min-w-[180px] max-w-xs rounded-xl border border-border-default shadow-xl text-xs"
          style={{
            transform: "translateX(-50%)",
            backgroundColor: "#18181b",
          }}
        >
          <div className="px-3 py-2 border-b border-border-default">
            <span className="font-semibold text-text-secondary">Cross-domain links</span>
          </div>
          <ul className="px-3 py-2 flex flex-col gap-1.5">
            {links.map((link, i) => (
              <li key={i} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "rgba(155, 27, 48, 0.2)",
                    color: "#9B1B30",
                    border: "1px solid rgba(155, 27, 48, 0.3)",
                  }}
                >
                  {link.domain}
                </span>
                <span className="text-text-muted truncate">{link.finding_type}</span>
                <span className="text-text-ghost shrink-0">#{link.pin_id}</span>
              </li>
            ))}
          </ul>
          {/* Arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderTopColor: "#3f3f46" }}
          />
        </div>
      )}
    </div>
  );
}
