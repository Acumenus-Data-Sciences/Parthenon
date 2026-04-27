import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EvidenceMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "success" | "warning" | "critical" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border-default bg-surface-base px-3 py-2">
      <p
        className={cn(
          "text-lg font-semibold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "critical" && "text-critical",
          tone === "neutral" && "text-text-secondary",
        )}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-text-ghost">{label}</p>
    </div>
  );
}

export function EvidenceBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-text-ghost">{title}</p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

export function EvidenceLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;

  return (
    <p className="text-xs text-text-muted">
      <span className="text-text-ghost">{label}:</span> {String(value)}
    </p>
  );
}
