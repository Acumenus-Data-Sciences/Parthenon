import { AlertCircle, AlertTriangle, Info, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeelResults, useRunHeel } from "../hooks/useAchillesData";
import type { HeelResult, HeelSeverity } from "../types/dataExplorer";

interface HeelTabProps {
  sourceId: number;
}

const SEVERITY_CONFIG: Record<
  HeelSeverity,
  { label: string; icon: typeof AlertCircle; rowClass: string; badgeClass: string; iconClass: string }
> = {
  error: {
    label: "Errors",
    icon: AlertCircle,
    rowClass: "border-[#E85A6B]/20 bg-[#E85A6B]/5",
    badgeClass: "bg-[#E85A6B]/15 text-[#E85A6B] border border-[#E85A6B]/30",
    iconClass: "text-[#E85A6B]",
  },
  warning: {
    label: "Warnings",
    icon: AlertTriangle,
    rowClass: "border-[#C9A227]/20 bg-[#C9A227]/5",
    badgeClass: "bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30",
    iconClass: "text-[#C9A227]",
  },
  notification: {
    label: "Notifications",
    icon: Info,
    rowClass: "border-[#3B82F6]/20 bg-[#3B82F6]/5",
    badgeClass: "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30",
    iconClass: "text-[#3B82F6]",
  },
};

function SeverityBadge({ severity }: { severity: HeelSeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.badgeClass)}>
      {severity}
    </span>
  );
}

function HeelResultRow({ result }: { result: HeelResult }) {
  const cfg = SEVERITY_CONFIG[result.severity];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4", cfg.rowClass)}>
      <Icon size={16} className={cn("mt-0.5 shrink-0", cfg.iconClass)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#F0EDE8]">{result.rule_name}</span>
          <SeverityBadge severity={result.severity} />
        </div>
        {result.attribute_name && (
          <p className="mt-1 text-xs text-[#8A857D]">
            <span className="text-[#C5C0B8]">{result.attribute_name}</span>
            {result.attribute_value != null && (
              <span className="ml-1 text-[#8A857D]">= {result.attribute_value}</span>
            )}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
          {result.record_count.toLocaleString()}
        </span>
        <p className="text-xs text-[#5A5650]">records</p>
      </div>
    </div>
  );
}

function SeveritySection({
  severity,
  results,
}: {
  severity: HeelSeverity;
  results: HeelResult[];
}) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;

  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon size={15} className={cfg.iconClass} />
        <h3 className="text-sm font-semibold text-[#C5C0B8] uppercase tracking-wide">
          {cfg.label}
        </h3>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.badgeClass)}>
          {results.length}
        </span>
      </div>
      <div className="space-y-2">
        {results.map((r) => (
          <HeelResultRow key={r.id} result={r} />
        ))}
      </div>
    </div>
  );
}

export default function HeelTab({ sourceId }: HeelTabProps) {
  const { data, isLoading } = useHeelResults(sourceId);
  const runMutation = useRunHeel(sourceId);

  const totalErrors = data?.error.length ?? 0;
  const totalWarnings = data?.warning.length ?? 0;
  const totalNotifications = data?.notification.length ?? 0;
  const totalIssues = totalErrors + totalWarnings + totalNotifications;
  const hasResults = data != null;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2.5 text-sm font-medium text-[#F0EDE8]",
            "hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {runMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PlayCircle size={14} />
          )}
          Run Heel Checks
        </button>

        {runMutation.isSuccess && runMutation.data && (
          <span className="text-xs text-[#2DD4BF]">
            {runMutation.data.completed} rules completed
            {runMutation.data.failed > 0 && `, ${runMutation.data.failed} failed`}
          </span>
        )}
        {runMutation.isError && (
          <span className="text-xs text-[#E85A6B]">Failed to run heel checks</span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* No results yet */}
      {!isLoading && !hasResults && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-16">
          <ShieldCheck size={32} className="mb-3 text-[#5A5650]" />
          <p className="text-sm text-[#8A857D]">No heel checks run yet</p>
          <p className="mt-1 text-xs text-[#5A5650]">
            Click "Run Heel Checks" to validate your data against OHDSI quality rules
          </p>
        </div>
      )}

      {/* Summary banner */}
      {hasResults && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3",
            totalErrors > 0
              ? "border-[#E85A6B]/20 bg-[#E85A6B]/5"
              : totalWarnings > 0
                ? "border-[#C9A227]/20 bg-[#C9A227]/5"
                : "border-[#2DD4BF]/20 bg-[#2DD4BF]/5",
          )}
        >
          {totalErrors > 0 ? (
            <AlertCircle size={16} className="shrink-0 text-[#E85A6B]" />
          ) : totalWarnings > 0 ? (
            <AlertTriangle size={16} className="shrink-0 text-[#C9A227]" />
          ) : (
            <ShieldCheck size={16} className="shrink-0 text-[#2DD4BF]" />
          )}
          <p className="text-sm text-[#C5C0B8]">
            {totalIssues === 0
              ? "All Achilles Heel checks passed — no data quality issues detected."
              : `${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found: ${totalErrors} error${totalErrors !== 1 ? "s" : ""}, ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}, ${totalNotifications} notification${totalNotifications !== 1 ? "s" : ""}.`}
          </p>
        </div>
      )}

      {/* Results by severity */}
      {hasResults && totalIssues > 0 && (
        <div className="space-y-6">
          <SeveritySection severity="error" results={data.error} />
          <SeveritySection severity="warning" results={data.warning} />
          <SeveritySection severity="notification" results={data.notification} />
        </div>
      )}
    </div>
  );
}
