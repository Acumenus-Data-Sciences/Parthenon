import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Loader2,
  Check,
  Play,
} from "lucide-react";
import {
  listStudyGates,
  evaluateStudyGates,
  approveStudyGate,
  overrideStudyGate,
  type GateStage,
  type GateStatus,
  type StudyGate,
} from "../api/gatesApi";

const STAGES: { stage: GateStage; label: string }[] = [
  { stage: "design", label: "1 · Design (PICO)" },
  { stage: "phenotype", label: "2 · Phenotype" },
  { stage: "cohort_diagnostics", label: "3 · Cohort Diagnostics" },
  { stage: "data_quality", label: "4 · Data Quality" },
  { stage: "study_diagnostics", label: "5 · Study Diagnostics" },
  { stage: "estimation_calibration", label: "6 · Estimation + Calibration" },
  { stage: "publication", label: "7 · Publication" },
];

function StatusPill({ status }: { status: GateStatus | "not_evaluated" }) {
  const map: Record<string, { label: string; cls: string }> = {
    passed: { label: "Passed", cls: "bg-success/15 text-success" },
    approved: { label: "Approved", cls: "bg-success/15 text-success" },
    overridden: { label: "Overridden", cls: "bg-accent/15 text-accent" },
    failed: { label: "Blocked", cls: "bg-critical/15 text-critical" },
    pending: { label: "Pending", cls: "bg-surface-overlay text-text-muted" },
    not_evaluated: { label: "Not evaluated", cls: "bg-surface-overlay text-text-ghost" },
  };
  const m = map[status] ?? map.not_evaluated;
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>{m.label}</span>
  );
}

function StageIcon({ status }: { status: GateStatus | "not_evaluated" }) {
  if (status === "passed" || status === "approved" || status === "overridden") {
    return <ShieldCheck size={16} className="text-success shrink-0" />;
  }
  if (status === "failed") {
    return <ShieldAlert size={16} className="text-critical shrink-0" />;
  }
  return <ShieldQuestion size={16} className="text-text-ghost shrink-0" />;
}

interface StudyGatesTabProps {
  slug: string;
  canDecide?: boolean;
}

export function StudyGatesTab({ slug, canDecide = false }: StudyGatesTabProps) {
  const queryClient = useQueryClient();
  const [overrideFor, setOverrideFor] = useState<number | null>(null);
  const [rationale, setRationale] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["study-gates", slug],
    queryFn: () => listStudyGates(slug),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["study-gates", slug] });

  const evaluate = useMutation({
    mutationFn: () => evaluateStudyGates(slug),
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: (gateId: number) => approveStudyGate(slug, gateId),
    onSuccess: invalidate,
  });
  const override = useMutation({
    mutationFn: (vars: { gateId: number; rationale: string }) =>
      overrideStudyGate(slug, vars.gateId, vars.rationale),
    onSuccess: () => {
      setOverrideFor(null);
      setRationale("");
      invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const byStage = new Map<GateStage, StudyGate>();
  (data?.data ?? []).forEach((gate) => byStage.set(gate.stage, gate));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Scientific Gates</h3>
          <p className="text-xs text-text-muted">
            {data?.gating_enabled
              ? "Gating is enabled — estimates stay blinded until the study-diagnostics gate clears."
              : "Gating is disabled for this environment (advisory only)."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => evaluate.mutate()}
          disabled={evaluate.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-elevated transition-colors"
        >
          {evaluate.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Play size={12} />
          )}
          Evaluate gates
        </button>
      </div>

      <div className="space-y-2">
        {STAGES.map(({ stage, label }) => {
          const gate = byStage.get(stage);
          const status: GateStatus | "not_evaluated" = gate?.status ?? "not_evaluated";
          const reasons = Array.isArray(gate?.metrics_json?.reasons)
            ? (gate?.metrics_json?.reasons as string[])
            : [];
          const isBlocked = status === "failed";

          return (
            <div
              key={stage}
              className="rounded-lg border border-border-default bg-surface-raised p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <StageIcon status={status} />
                  <span className="text-sm text-text-primary truncate">{label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill status={status} />
                  {canDecide && isBlocked && (
                    <>
                      <button
                        type="button"
                        onClick={() => gate && approve.mutate(gate.id)}
                        className="rounded px-2 py-0.5 text-[10px] font-medium text-success hover:bg-success/10"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverrideFor(gate?.id ?? null)}
                        className="rounded px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/10"
                      >
                        Override
                      </button>
                    </>
                  )}
                </div>
              </div>

              {reasons.length > 0 && status === "failed" && (
                <ul className="mt-2 space-y-1 pl-6">
                  {reasons.map((reason, i) => (
                    <li key={i} className="text-xs text-critical">
                      {reason}
                    </li>
                  ))}
                </ul>
              )}

              {gate?.status === "overridden" && gate.override_rationale && (
                <p className="mt-2 pl-6 text-xs text-text-muted">
                  <span className="text-accent font-medium">Override:</span>{" "}
                  {gate.override_rationale}
                </p>
              )}

              {gate?.status === "approved" && (
                <p className="mt-2 pl-6 text-xs text-success flex items-center gap-1">
                  <Check size={11} /> Approved by reviewer.
                </p>
              )}

              {canDecide && overrideFor === gate?.id && (
                <div className="mt-3 pl-6 space-y-2">
                  <textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Written rationale (required, min 10 chars) — appears verbatim in the publication's limitations."
                    className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={rationale.trim().length < 10 || override.isPending}
                      onClick={() =>
                        gate && override.mutate({ gateId: gate.id, rationale: rationale.trim() })
                      }
                      className="rounded-md bg-accent/15 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
                    >
                      {override.isPending ? "Saving…" : "Confirm override"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideFor(null);
                        setRationale("");
                      }}
                      className="rounded-md px-3 py-1 text-xs text-text-muted hover:text-text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
