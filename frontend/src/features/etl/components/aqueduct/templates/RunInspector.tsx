import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronDown, ChevronRight, X, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTemplate,
  useTemplateRun,
  useTemplateRunLogs,
  useTemplateRunArtifacts,
  useCancelTemplateRun,
  useSubmitTemplateRun,
} from "../../../api/templates";
import { isTerminal } from "../../../types/templates";
import { RunStatusBadge } from "./RunStatusBadge";
import { RunLogsView } from "./RunLogsView";
import { RunArtifactsView } from "./RunArtifactsView";
import { RunDagView } from "./RunDagView";

export interface RunInspectorProps {
  runId: number;
  onRetried?: (newRunId: number) => void;
}

interface SectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function Section({ title, open, onToggle, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-border-default bg-surface-raised">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-text-primary"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && (
        <div className="border-t border-border-default p-4">{children}</div>
      )}
    </section>
  );
}

export function RunInspector({ runId, onRetried }: RunInspectorProps) {
  const { t } = useTranslation("app");
  const runQ = useTemplateRun(runId);
  const manifestQ = useTemplate(runQ.data?.template_id ?? null);
  const logsQ = useTemplateRunLogs(runId, runQ.data?.status);
  const artifactsQ = useTemplateRunArtifacts(runId, runQ.data?.status);
  const cancelMut = useCancelTemplateRun(runId);
  const submitMut = useSubmitTemplateRun();

  const [openDag, setOpenDag] = useState(true);
  const [openLogs, setOpenLogs] = useState(true);
  const [openArtifacts, setOpenArtifacts] = useState(false);

  if (runQ.isLoading || !runQ.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const run = runQ.data;
  const terminal = isTerminal(run.status);
  const failedOrCancelled =
    run.status === "failed" || run.status === "cancelled";

  function handleRetry() {
    submitMut.mutate(
      {
        templateId: run.template_id,
        version: run.template_version,
        parameters: run.parameters,
      },
      {
        onSuccess: (resp) => {
          onRetried?.(resp.id);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-raised px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {manifestQ.data?.name ?? run.template_id}
          </h2>
          <p className="text-xs text-text-muted">
            {t("aqueduct.runInspector.versionLabel", {
              defaultValue: "Version",
            })}{" "}
            <span className="font-['IBM_Plex_Mono',monospace]">
              {run.template_version}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RunStatusBadge status={run.status} />
          {!terminal && (
            <button
              type="button"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-critical/40 bg-critical/10 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/20",
                "disabled:opacity-50",
              )}
            >
              <X size={12} />
              {t("aqueduct.runInspector.cancel", {
                defaultValue: "Cancel run",
              })}
            </button>
          )}
          {failedOrCancelled && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={submitMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-50"
            >
              <RotateCw size={12} />
              {t("aqueduct.runInspector.retry", { defaultValue: "Retry" })}
            </button>
          )}
        </div>
      </div>

      {run.error_message && (
        <div className="rounded-lg border border-critical/40 bg-critical/10 p-4 text-sm text-critical">
          {run.error_message}
        </div>
      )}

      <Section
        title={t("aqueduct.runInspector.dag", { defaultValue: "DAG" })}
        open={openDag}
        onToggle={() => setOpenDag((v) => !v)}
      >
        {manifestQ.data ? (
          <RunDagView
            nodes={manifestQ.data.nodes}
            currentNode={run.current_node}
            status={run.status}
          />
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-text-muted" />
          </div>
        )}
      </Section>

      <Section
        title={t("aqueduct.runInspector.logs", { defaultValue: "Logs" })}
        open={openLogs}
        onToggle={() => setOpenLogs((v) => !v)}
      >
        <RunLogsView logs={logsQ.data ?? []} isRunning={!terminal} />
      </Section>

      <Section
        title={t("aqueduct.runInspector.artifacts", {
          defaultValue: "Artifacts",
        })}
        open={openArtifacts}
        onToggle={() => setOpenArtifacts((v) => !v)}
      >
        <RunArtifactsView artifacts={artifactsQ.data ?? []} />
      </Section>
    </div>
  );
}
