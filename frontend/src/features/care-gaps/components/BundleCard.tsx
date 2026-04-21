import { useNavigate } from "react-router-dom";
import { Activity, Layers, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ComplianceRing } from "./ComplianceRing";
import { getCareGapCategoryLabel, getCareGapStatusLabel } from "../lib/i18n";
import type { ConditionBundle } from "../types/careGap";

interface BundleCardProps {
  bundle: ConditionBundle;
}

const CATEGORY_COLORS: Record<string, string> = {
  Endocrine: "var(--accent)",
  Cardiovascular: "var(--critical)",
  Respiratory: "var(--success)",
  "Mental Health": "var(--info)",
  Rheumatologic: "var(--warning)",
  Neurological: "var(--domain-observation)",
  Oncology: "var(--primary)",
};

function getCategoryBorderColor(category: string | null): string {
  if (!category) return "var(--surface-elevated)";
  return CATEGORY_COLORS[category] ?? "var(--text-muted)";
}

function EvalStatusBadge({
  status,
}: {
  status: "pending" | "running" | "completed" | "failed";
}) {
  const { t } = useTranslation("app");
  const config = {
    pending: {
      icon: Clock,
      color: "var(--text-muted)",
      label: getCareGapStatusLabel(t, "pending"),
    },
    running: {
      icon: Loader2,
      color: "var(--warning)",
      label: getCareGapStatusLabel(t, "running"),
    },
    completed: {
      icon: CheckCircle2,
      color: "var(--success)",
      label: getCareGapStatusLabel(t, "completed"),
    },
    failed: {
      icon: XCircle,
      color: "var(--critical)",
      label: getCareGapStatusLabel(t, "failed"),
    },
  } as const;

  const c = config[status];
  const Icon = c.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${c.color}15`, color: c.color }}
    >
      <Icon
        size={10}
        className={status === "running" ? "animate-spin" : ""}
      />
      {c.label}
    </span>
  );
}

export function BundleCard({ bundle }: BundleCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("app");
  const borderColor = getCategoryBorderColor(bundle.disease_category);

  const evaluation = bundle.latest_evaluation;
  const compliance =
    evaluation?.status === "completed"
      ? evaluation.compliance_summary?.compliance_pct ?? null
      : null;

  return (
    <button
      type="button"
      onClick={() => navigate(`/care-gaps/${bundle.id}`)}
      className={cn(
        "w-full text-left rounded-lg border bg-surface-raised p-4 transition-all",
        "hover:bg-surface-overlay hover:border-surface-highlight",
        "border-l-[3px]",
      )}
      style={{ borderLeftColor: borderColor, borderColor: `var(--border-default)` }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Bundle code badge */}
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success">
            {bundle.bundle_code}
          </span>

          {/* Condition name */}
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {bundle.condition_name}
          </h3>

          {/* Disease category */}
          {bundle.disease_category && (
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${getCategoryBorderColor(bundle.disease_category)}15`,
                color: getCategoryBorderColor(bundle.disease_category),
              }}
            >
              {getCareGapCategoryLabel(t, bundle.disease_category)}
            </span>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Layers size={11} />
              {t("careGaps.common.bundle.measure", {
                count: bundle.measures?.length ?? bundle.bundle_size,
              })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Activity size={11} />
              {bundle.is_active
                ? t("careGaps.common.bundle.active")
                : t("careGaps.common.bundle.inactive")}
            </span>
          </div>

          {/* Evaluation status */}
          {evaluation && <EvalStatusBadge status={evaluation.status} />}
        </div>

        {/* Compliance ring */}
        {compliance != null && (
          <div className="shrink-0">
            <ComplianceRing percentage={compliance} size="sm" />
          </div>
        )}
      </div>
    </button>
  );
}
