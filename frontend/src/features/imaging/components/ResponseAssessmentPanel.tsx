import { useState } from "react";
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

const RESPONSE_STYLES: Record<string, { color: string; bg: string; icon: typeof CheckCircle2; label: string }> = {
  CR: { color: "var(--success)", bg: "var(--success)", icon: CheckCircle2, label: "Complete Response" },
  PR: { color: "var(--info)", bg: "var(--info)", icon: Activity, label: "Partial Response" },
  SD: { color: "var(--accent)", bg: "var(--accent)", icon: MinusCircle, label: "Stable Disease" },
  PD: { color: "var(--critical)", bg: "var(--critical)", icon: XCircle, label: "Progressive Disease" },
  NE: { color: "var(--text-muted)", bg: "var(--text-muted)", icon: HelpCircle, label: "Not Evaluable" },
};

const CRITERIA_LABELS: Record<string, string> = {
  recist: "RECIST 1.1",
  ct_severity: "CT Severity",
  deauville: "Deauville/Lugano",
  rano: "RANO",
};

interface ResponseAssessmentPanelProps {
  personId: number;
  studies: TimelineStudy[];
}

export default function ResponseAssessmentPanel({ personId, studies }: ResponseAssessmentPanelProps) {
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
      <div className="rounded-lg border border-[var(--domain-observation)]/30 bg-[var(--domain-observation)]/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[var(--domain-observation)]" />
          <h3 className="text-sm font-semibold text-text-primary">Compute Response Assessment</h3>
        </div>
        <p className="text-xs text-text-muted">
          Automatically computes treatment response by comparing measurements across timepoints using RECIST 1.1, CT Severity, Deauville/Lugano, or RANO criteria.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-text-muted mb-1">Current Study (timepoint)</label>
            <select
              className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[var(--domain-observation)] transition-colors"
              value={selectedStudyId}
              onChange={(e) => setSelectedStudyId(parseInt(e.target.value))}
            >
              <option value="0">Select a study…</option>
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
            <label className="block text-xs text-text-muted mb-1">Criteria</label>
            <select
              className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[var(--domain-observation)] transition-colors"
              value={selectedCriteria}
              onChange={(e) => setSelectedCriteria(e.target.value)}
            >
              <option value="auto">Auto-detect</option>
              <option value="recist">RECIST 1.1</option>
              <option value="ct_severity">CT Severity</option>
              <option value="deauville">Deauville/Lugano</option>
              <option value="rano">RANO</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCompute}
            disabled={!selectedStudyId || computeMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--domain-observation)] px-4 py-2 text-sm font-medium text-white hover:bg-[#8B5CF6] disabled:opacity-50 transition-colors"
          >
            {computeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            Assess
          </button>
        </div>

        {/* Newly computed result */}
        {computeMutation.isSuccess && (
          <ResponseBadge assessment={computeMutation.data as ImagingResponseAssessment} expanded />
        )}

        {computeMutation.isError && (
          <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
            {(computeMutation.error as Error)?.message ?? "Assessment failed"}
          </div>
        )}
      </div>

      {/* Assessment History */}
      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="px-4 py-3 border-b border-border-default">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Activity size={14} className="text-success" />
            Assessment History
          </h3>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-success" />
          </div>
        )}

        {!isLoading && (!assessments || assessments.length === 0) && (
          <div className="p-6 text-center text-sm text-text-ghost">
            No response assessments computed yet. Select a study timepoint above to compute one.
          </div>
        )}

        {assessments && assessments.length > 0 && (
          <div className="divide-y divide-[#1E1E23]">
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
  const style = RESPONSE_STYLES[assessment.response_category] ?? RESPONSE_STYLES.NE;
  const Icon = style.icon;
  const criteria = CRITERIA_LABELS[assessment.criteria_type] ?? assessment.criteria_type;

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

        <span className="text-xs text-text-muted">{style.label}</span>
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
                <span className="text-[10px] text-text-ghost">vs Baseline:</span>
                <PercentChip value={assessment.percent_change_from_baseline} />
              </div>
            )}
            {assessment.percent_change_from_nadir !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-text-ghost">vs Nadir:</span>
                <PercentChip value={assessment.percent_change_from_nadir} />
              </div>
            )}
          </div>

          {/* Confirmation status */}
          {assessment.is_confirmed && (
            <div className="flex items-center gap-1.5 text-[10px] text-success">
              <CheckCircle2 size={10} />
              Confirmed
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-base border border-border-default px-3 py-2">
      <p className="text-[10px] text-text-ghost uppercase tracking-wider">{label}</p>
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
