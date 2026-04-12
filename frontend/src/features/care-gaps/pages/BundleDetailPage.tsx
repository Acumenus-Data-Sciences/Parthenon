import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceSelector } from "@/features/data-explorer/components/SourceSelector";
import { ComplianceRing } from "../components/ComplianceRing";
import { BundleDesigner } from "../components/BundleDesigner";
import { MeasureComplianceTable } from "../components/MeasureComplianceTable";
import { OverlapRulesPanel } from "../components/OverlapRulesPanel";
import {
  useBundle,
  useDeleteBundle,
  useEvaluateBundle,
  useEvaluations,
  useEvaluation,
} from "../hooks/useCareGaps";
import type { CareGapEvaluation } from "../types/careGap";

type Tab = "design" | "compliance" | "overlap";

function EvalStatusBadge({
  status,
}: {
  status: CareGapEvaluation["status"];
}) {
  const config = {
    pending: { icon: Clock, color: "var(--text-muted)", label: "Pending" },
    running: { icon: Loader2, color: 'var(--warning)', label: "Running" },
    completed: { icon: CheckCircle2, color: "var(--success)", label: "Completed" },
    failed: { icon: XCircle, color: "var(--critical)", label: "Failed" },
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

export default function BundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bundleId = id ? Number(id) : null;

  const { data: bundle, isLoading, error } = useBundle(bundleId);
  const deleteMutation = useDeleteBundle();
  const evaluateMutation = useEvaluateBundle();
  const { data: evaluations } = useEvaluations(bundleId);

  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [evalSourceId, setEvalSourceId] = useState<number | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<number | null>(null);

  // Auto-select latest completed evaluation for results display
  const latestCompleted = evaluations?.find(
    (e: CareGapEvaluation) => e.status === "completed",
  );
  const activeEvalId = selectedEvalId ?? latestCompleted?.id ?? null;

  const { data: activeEvaluation } = useEvaluation(bundleId, activeEvalId);

  const handleDelete = () => {
    if (!bundleId) return;
    if (
      window.confirm(
        "Are you sure you want to delete this condition bundle?",
      )
    ) {
      deleteMutation.mutate(bundleId, {
        onSuccess: () => navigate("/care-gaps"),
      });
    }
  };

  const handleEvaluate = () => {
    if (!bundleId || !evalSourceId) return;
    evaluateMutation.mutate({ bundleId, sourceId: evalSourceId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-critical">Failed to load bundle</p>
          <button
            type="button"
            onClick={() => navigate("/care-gaps")}
            className="mt-4 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/care-gaps")}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Care Gaps
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              {bundle.condition_name}
            </h1>
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success">
              {bundle.bundle_code}
            </span>
          </div>

          {bundle.description && (
            <p className="mt-1 text-sm text-text-muted">
              {bundle.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {bundle.disease_category && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent">
                {bundle.disease_category}
              </span>
            )}
            {bundle.latest_evaluation && (
              <EvalStatusBadge
                status={bundle.latest_evaluation.status}
              />
            )}
          </div>
        </div>

        {/* Compliance ring (if available) */}
        {bundle.latest_evaluation?.compliance_summary && (
          <div className="shrink-0">
            <ComplianceRing
              percentage={
                bundle.latest_evaluation.compliance_summary.compliance_pct
              }
              size="lg"
              label="Overall Compliance"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-critical hover:border-critical/30 transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border-default">
        {(
          [
            { key: "design" as const, label: "Design" },
            { key: "compliance" as const, label: "Compliance Results" },
            { key: "overlap" as const, label: "Overlap Rules" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-success"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "design" && <BundleDesigner bundleId={bundleId} />}

      {activeTab === "compliance" && (
        <div className="space-y-6">
          {/* Evaluation controls */}
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Execute Evaluation
            </h3>
            <div className="flex items-center gap-3">
              <SourceSelector
                value={evalSourceId}
                onChange={setEvalSourceId}
              />
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={
                  !evalSourceId || evaluateMutation.isPending
                }
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  "bg-success text-surface-base hover:bg-success",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {evaluateMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                Evaluate
              </button>
            </div>
          </div>

          {/* Results */}
          {activeEvaluation?.result_json ? (
            <div className="space-y-4">
              {/* Overall summary */}
              <div className="rounded-lg border border-border-default bg-surface-raised p-4">
                <div className="flex items-center gap-6">
                  <ComplianceRing
                    percentage={
                      activeEvaluation.result_json.overall_compliance_pct
                    }
                    size="md"
                    label="Overall"
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-text-muted">Total Patients</p>
                    <p className="font-['IBM_Plex_Mono',monospace] text-lg font-bold text-success">
                      {activeEvaluation.result_json.total_patients.toLocaleString()}
                    </p>
                  </div>
                  {activeEvaluation.compliance_summary && (
                    <>
                      <div className="space-y-1">
                        <p className="text-xs text-text-muted">Gaps Met</p>
                        <p className="font-['IBM_Plex_Mono',monospace] text-lg font-bold text-success">
                          {activeEvaluation.compliance_summary.met.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-text-muted">Open Gaps</p>
                        <p className="font-['IBM_Plex_Mono',monospace] text-lg font-bold text-primary">
                          {activeEvaluation.compliance_summary.open.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-text-muted">Excluded</p>
                        <p className="font-['IBM_Plex_Mono',monospace] text-lg font-bold text-text-muted">
                          {activeEvaluation.compliance_summary.excluded.toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Measure table */}
              <MeasureComplianceTable
                measures={activeEvaluation.result_json.measures}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
              <p className="text-sm text-text-muted">
                {evaluateMutation.isPending
                  ? "Evaluation in progress..."
                  : "No evaluation results yet. Execute an evaluation to see compliance data."}
              </p>
            </div>
          )}

          {/* Evaluation history */}
          {evaluations && evaluations.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-raised p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">
                Evaluation History
              </h3>
              <div className="space-y-1">
                {evaluations.map((ev: CareGapEvaluation) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setSelectedEvalId(ev.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      activeEvalId === ev.id
                        ? "bg-success/10 border border-success/20"
                        : "hover:bg-surface-overlay border border-transparent",
                    )}
                  >
                    <EvalStatusBadge status={ev.status} />
                    <span className="text-xs text-text-muted">
                      Source #{ev.source_id}
                    </span>
                    {ev.person_count != null && (
                      <span className="text-xs text-text-secondary font-['IBM_Plex_Mono',monospace]">
                        {ev.person_count.toLocaleString()} pts
                      </span>
                    )}
                    {ev.compliance_summary && (
                      <span
                        className="text-xs font-bold font-['IBM_Plex_Mono',monospace] ml-auto"
                        style={{
                          color:
                            ev.compliance_summary.compliance_pct >= 80
                              ? "var(--success)"
                              : ev.compliance_summary.compliance_pct >= 50
                                ? "var(--accent)"
                                : "var(--primary)",
                        }}
                      >
                        {ev.compliance_summary.compliance_pct.toFixed(0)}%
                      </span>
                    )}
                    <span className="text-[10px] text-text-ghost">
                      {ev.evaluated_at
                        ? new Date(ev.evaluated_at).toLocaleDateString()
                        : ev.created_at
                          ? new Date(ev.created_at).toLocaleDateString()
                          : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "overlap" && <OverlapRulesPanel />}
    </div>
  );
}
