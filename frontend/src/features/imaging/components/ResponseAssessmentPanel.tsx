import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity, Loader2, CheckCircle2, XCircle, MinusCircle,
  HelpCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  usePatientResponseAssessments,
  useComputeResponse,
} from "../hooks/useImaging";
import type { ImagingResponseAssessment, TimelineStudy } from "../types";

// ── Response Category Styling ────────────────────────────────────────────

const RESPONSE_STYLES: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  CR: { color: "var(--success)", bg: "var(--success)", icon: CheckCircle2 },
  PR: { color: "var(--info)", bg: "var(--info)", icon: Activity },
  SD: { color: "var(--accent)", bg: "var(--accent)", icon: MinusCircle },
  PD: { color: "var(--critical)", bg: "var(--critical)", icon: XCircle },
  NE: { color: "var(--text-muted)", bg: "var(--text-muted)", icon: HelpCircle },
};

const CRITERIA_LABELS: Record<string, "recist" | "ctSeverity" | "deauville" | "rano"> = {
  recist: "recist",
  ct_severity: "ctSeverity",
  deauville: "deauville",
  rano: "rano",
};

interface ResponseAssessmentPanelProps {
  personId: number;
  studies: TimelineStudy[];
}

export default function ResponseAssessmentPanel({ personId, studies }: ResponseAssessmentPanelProps) {
  const { t } = useTranslation("app");
  const { data: assessments, isLoading } = usePatientResponseAssessments(personId);
  const computeMutation = useComputeResponse();

  const [selectedStudyId, setSelectedStudyId] = useState<number>(0);
  const [selectedCriteria, setSelectedCriteria] = useState("auto");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleCompute = () => {
    if (!selectedStudyId) return;
    computeMutation.mutate({
      personId,
      current_study_id: selectedStudyId,
      criteria_type: selectedCriteria,
    });
  };

  return (
    <div className="space-y-4">
      {/* Compute new assessment */}
      <div className="rounded-lg border border-domain-observation/30 bg-domain-observation/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-domain-observation" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t("imaging.response.computeTitle")}
          </h3>
        </div>
        <p className="text-xs text-text-muted">
          {t("imaging.response.help")}
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-text-muted mb-1">
              {t("imaging.response.currentStudy")}
            </label>
            <select
              className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-domain-observation transition-colors"
              value={selectedStudyId}
              onChange={(e) => setSelectedStudyId(parseInt(e.target.value))}
            >
              <option value="0">{t("imaging.response.selectStudy")}</option>
              {studies
                .filter(s => s.measurement_count > 0)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.study_date ?? "Unknown"} — {s.modality ?? "?"} · {s.measurement_count} measurements
                  </option>
                ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs text-text-muted mb-1">
              {t("imaging.response.criteria")}
            </label>
            <select
              className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-domain-observation transition-colors"
              value={selectedCriteria}
              onChange={(e) => setSelectedCriteria(e.target.value)}
            >
              <option value="auto">{t("imaging.response.autoDetect")}</option>
              <option value="recist">{t("imaging.response.criteriaLabels.recist")}</option>
              <option value="ct_severity">{t("imaging.response.criteriaLabels.ctSeverity")}</option>
              <option value="deauville">{t("imaging.response.criteriaLabels.deauville")}</option>
              <option value="rano">{t("imaging.response.criteriaLabels.rano")}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCompute}
            disabled={!selectedStudyId || computeMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-domain-observation px-4 py-2 text-sm font-medium text-text-primary hover:bg-domain-observation disabled:opacity-50 transition-colors"
          >
            {computeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            {t("imaging.response.assess")}
          </button>
        </div>

        {/* Newly computed result */}
        {computeMutation.isSuccess && (
          <ResponseBadge assessment={computeMutation.data as ImagingResponseAssessment} expanded />
        )}

        {computeMutation.isError && (
          <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
            {(computeMutation.error as Error)?.message ?? t("imaging.response.assessmentFailed")}
          </div>
        )}
      </div>

      {/* Assessment History */}
      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="px-4 py-3 border-b border-border-default">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Activity size={14} className="text-success" />
            {t("imaging.response.assessmentHistory")}
          </h3>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-success" />
          </div>
        )}

        {!isLoading && (!assessments || assessments.length === 0) && (
          <div className="p-6 text-center text-sm text-text-ghost">
            {t("imaging.response.empty")}
          </div>
        )}

        {assessments && assessments.length > 0 && (
          <div className="divide-y divide-border-subtle">
            {assessments.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="w-full"
                >
                  <ResponseBadge assessment={a} expanded={expandedId === a.id} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Response Badge ───────────────────────────────────────────────────────

function ResponseBadge({ assessment, expanded }: { assessment: ImagingResponseAssessment; expanded?: boolean }) {
  const { t } = useTranslation("app");
  const style = RESPONSE_STYLES[assessment.response_category] ?? RESPONSE_STYLES.NE;
  const Icon = style.icon;
  const criteriaKey = CRITERIA_LABELS[assessment.criteria_type];
  const criteria = criteriaKey ? t(`imaging.response.criteriaLabels.${criteriaKey}`) : assessment.criteria_type;
  const label =
    assessment.response_category === "CR"
      ? t("imaging.response.categoryLabels.completeResponse")
      : assessment.response_category === "PR"
        ? t("imaging.response.categoryLabels.partialResponse")
        : assessment.response_category === "SD"
          ? t("imaging.response.categoryLabels.stableDisease")
          : assessment.response_category === "PD"
            ? t("imaging.response.categoryLabels.progressiveDisease")
            : t("imaging.response.categoryLabels.notEvaluable");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Category badge */}
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{ backgroundColor: `${style.bg}18`, color: style.color }}
        >
          <Icon size={14} />
          <span className="text-xs font-semibold">{assessment.response_category}</span>
        </div>

        <span className="text-xs text-text-muted">{label}</span>
        <span className="text-[10px] text-text-ghost bg-surface-elevated px-2 py-0.5 rounded">{criteria}</span>
        <span className="text-xs text-text-ghost ml-auto">
          {new Date(assessment.assessment_date).toLocaleDateString()}
        </span>

        {expanded ? (
          <ChevronUp size={14} className="text-text-ghost" />
        ) : (
          <ChevronDown size={14} className="text-text-ghost" />
        )}
      </div>

      {expanded && (
        <div className="pl-4 space-y-2">
          {/* Rationale */}
          {assessment.rationale && (
            <p className="text-xs text-text-muted italic">{assessment.rationale}</p>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2">
            {assessment.baseline_value !== null && (
              <MetricCard label="Baseline" value={assessment.baseline_value} />
            )}
            {assessment.nadir_value !== null && (
              <MetricCard label="Nadir" value={assessment.nadir_value} />
            )}
            {assessment.current_value !== null && (
              <MetricCard label="Current" value={assessment.current_value} />
            )}
          </div>

          {/* Percent changes */}
          <div className="flex gap-4">
            {assessment.percent_change_from_baseline !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-text-ghost">{t("imaging.response.vsBaseline")}</span>
                <PercentChip value={assessment.percent_change_from_baseline} />
              </div>
            )}
            {assessment.percent_change_from_nadir !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-text-ghost">{t("imaging.response.vsNadir")}</span>
                <PercentChip value={assessment.percent_change_from_nadir} />
              </div>
            )}
          </div>

          {/* Confirmation status */}
          {assessment.is_confirmed && (
            <div className="flex items-center gap-1.5 text-[10px] text-success">
              <CheckCircle2 size={10} />
              {t("imaging.response.confirmed")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  const { t } = useTranslation("app");
  const translatedLabel =
    label === "Baseline"
      ? t("imaging.response.baseline")
      : label === "Nadir"
        ? t("imaging.response.nadir")
        : label === "Current"
          ? t("imaging.response.current")
          : label;
  return (
    <div className="rounded-lg bg-surface-base border border-border-default px-3 py-2">
      <p className="text-[10px] text-text-ghost uppercase tracking-wider">{translatedLabel}</p>
      <p className="text-sm font-semibold font-mono text-text-primary">{value.toFixed(1)}</p>
    </div>
  );
}

function PercentChip({ value }: { value: number }) {
  const color = value > 5 ? "var(--critical)" : value < -5 ? "var(--success)" : "var(--accent)";
  return (
    <span
      className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}
