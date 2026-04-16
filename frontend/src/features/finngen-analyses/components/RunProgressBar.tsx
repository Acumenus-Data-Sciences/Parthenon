// frontend/src/features/finngen-analyses/components/RunProgressBar.tsx
import type { FinnGenRun } from "@/features/_finngen-foundation";

interface RunProgressBarProps {
  run: FinnGenRun;
}

export function RunProgressBar({ run }: RunProgressBarProps) {
  const pct = run.progress?.pct ?? 0;
  const step = run.progress?.step ?? run.status;
  const message = run.progress?.message ?? "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted font-medium capitalize">{step}</span>
        <span className="text-text-ghost">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
        <div
          className="h-full rounded-full bg-success transition-all duration-500 ease-out"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {message && (
        <p className="text-xs text-text-ghost">{message}</p>
      )}
    </div>
  );
}
