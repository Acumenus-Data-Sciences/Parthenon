import { useNavigate } from "react-router-dom";
import { Activity, Layers, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComplianceRing } from "./ComplianceRing";
import type { ConditionBundle } from "../types/careGap";

interface BundleCardProps {
  bundle: ConditionBundle;
}

const CATEGORY_COLORS: Record<string, string> = {
  Endocrine: "#C9A227",
  Cardiovascular: "#E85A6B",
  Respiratory: "#2DD4BF",
  "Mental Health": "#818CF8",
  Rheumatologic: "#F59E0B",
  Neurological: "#A78BFA",
  Oncology: "#9B1B30",
};

function getCategoryBorderColor(category: string | null): string {
  if (!category) return "#232328";
  return CATEGORY_COLORS[category] ?? "#8A857D";
}

function EvalStatusBadge({
  status,
}: {
  status: "pending" | "running" | "completed" | "failed";
}) {
  const config = {
    pending: { icon: Clock, color: "#8A857D", label: "Pending" },
    running: { icon: Loader2, color: "#F59E0B", label: "Running" },
    completed: { icon: CheckCircle2, color: "#2DD4BF", label: "Completed" },
    failed: { icon: XCircle, color: "#E85A6B", label: "Failed" },
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
        "w-full text-left rounded-lg border bg-[#151518] p-4 transition-all",
        "hover:bg-[#1A1A1E] hover:border-[#323238]",
        "border-l-[3px]",
      )}
      style={{ borderLeftColor: borderColor, borderColor: `#232328` }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Bundle code badge */}
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/10 text-[#2DD4BF]">
            {bundle.bundle_code}
          </span>

          {/* Condition name */}
          <h3 className="text-sm font-semibold text-[#F0EDE8] truncate">
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
              {bundle.disease_category}
            </span>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px] text-[#8A857D]">
            <span className="inline-flex items-center gap-1">
              <Layers size={11} />
              {bundle.measures?.length ?? bundle.bundle_size} measures
            </span>
            <span className="inline-flex items-center gap-1">
              <Activity size={11} />
              {bundle.is_active ? "Active" : "Inactive"}
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
