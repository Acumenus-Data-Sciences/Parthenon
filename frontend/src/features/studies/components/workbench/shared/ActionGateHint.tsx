import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActionGateHint({
  message,
  tone = "warning",
}: {
  message: string | null;
  tone?: "warning" | "neutral";
}) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
        tone === "warning" && "border-warning/30 bg-warning/5 text-warning",
        tone === "neutral" && "border-border-default bg-surface-base text-text-muted",
      )}
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
