import { Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DqdRunSummary, DqdCategorySummary } from "../../types/dataExplorer";

interface DqdScorecardProps {
  summary: DqdRunSummary | null;
}

const CATEGORY_META: Record<string, { labelKey: string; icon: typeof Shield; color: string }> = {
  completeness: { labelKey: "completeness", icon: Shield, color: "text-info" },
  conformance: { labelKey: "conformance", icon: CheckCircle2, color: "text-domain-observation" },
  plausibility: { labelKey: "plausibility", icon: AlertTriangle, color: "text-warning" },
};

function ScoreRing({
  passed,
  total,
  size = 80,
}: {
  passed: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 90 ? "var(--success)" : pct >= 70 ? "var(--warning)" : "var(--critical)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-elevated)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
          style={{ color }}
        >
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

export function DqdScorecard({ summary }: DqdScorecardProps) {
  const { t } = useTranslation("app");

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <Shield className="h-10 w-10 text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">
          {t("dataExplorer.dqd.scorecard.emptyTitle")}
        </p>
        <p className="mt-1 text-xs text-text-ghost">
          {t("dataExplorer.dqd.scorecard.emptyDescription")}
        </p>
      </div>
    );
  }

  const { total_checks, passed, failed, by_category } = summary;

  return (
    <div className="space-y-4">
      {/* Score rings row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Overall */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-raised py-6">
          <ScoreRing passed={passed} total={total_checks} size={96} />
          <span className="mt-2 text-sm text-text-muted">
            {t("dataExplorer.dqd.scorecard.overallScore")}
          </span>
          <span className="mt-0.5 text-xs text-text-ghost">
            {t("dataExplorer.dqd.scorecard.passedFraction", {
              passed,
              total: total_checks,
            })}
          </span>
        </div>

        {/* Per-category */}
        {by_category.map((cat: DqdCategorySummary) => {
          const meta = CATEGORY_META[cat.category] ?? {
            labelKey: "",
            icon: Shield,
            color: "text-text-muted",
          };
          const label = meta.labelKey
            ? t(`dataExplorer.dqd.categories.${meta.labelKey}`)
            : cat.category;
          const Icon = meta.icon;

          return (
            <div
              key={cat.category}
              className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-raised py-6"
            >
              <ScoreRing passed={cat.passed} total={cat.total} size={72} />
              <div className="mt-2 flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                <span className="text-sm text-text-secondary">{label}</span>
              </div>
              <span className="mt-0.5 text-xs text-text-ghost">
                {t("dataExplorer.dqd.scorecard.passedFraction", {
                  passed: cat.passed,
                  total: cat.total,
                })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 rounded-xl border border-border-default bg-surface-raised px-6 py-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-success">
            {passed}
          </span>
          <span className="text-sm text-text-muted">
            {t("dataExplorer.dqd.labels.passed")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-warning">
            {summary.warnings}
          </span>
          <span className="text-sm text-text-muted">
            {t("dataExplorer.dqd.labels.warnings")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-critical" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-critical">
            {failed}
          </span>
          <span className="text-sm text-text-muted">
            {t("dataExplorer.dqd.labels.failed")}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-overlay">
            {passed > 0 && (
              <div
                className="bg-success transition-all"
                style={{ width: `${(passed / total_checks) * 100}%` }}
              />
            )}
            {failed > 0 && (
              <div
                className="bg-critical transition-all"
                style={{ width: `${(failed / total_checks) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
