import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TemplateRunLog } from "../../../types/templates";

const LEVEL_COLOR: Record<TemplateRunLog["level"], string> = {
  debug: "text-text-ghost",
  info: "text-text-secondary",
  warn: "text-warning",
  error: "text-critical",
};

export interface RunLogsViewProps {
  logs: TemplateRunLog[];
  isRunning: boolean;
}

export function RunLogsView({ logs, isRunning }: RunLogsViewProps) {
  const { t } = useTranslation("app");
  const anchor = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isRunning && anchor.current) {
      anchor.current.scrollIntoView({ block: "end" });
    }
  }, [logs, isRunning]);

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised p-6 text-center text-sm text-text-muted">
        {t("aqueduct.runInspector.noLogs", { defaultValue: "No logs yet" })}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-base">
      <pre
        data-testid="run-logs-pre"
        className="max-h-96 overflow-auto p-4 text-xs leading-relaxed font-['IBM_Plex_Mono',monospace]"
      >
        {logs.map((line, idx) => (
          <div key={idx} className={cn(LEVEL_COLOR[line.level])}>
            <span className="text-text-ghost">{line.timestamp}</span>
            {line.node_id ? (
              <span className="text-text-muted"> [{line.node_id}]</span>
            ) : null}
            <span className="uppercase"> {line.level}</span>
            <span> {line.message}</span>
          </div>
        ))}
        <div ref={anchor} />
      </pre>
    </div>
  );
}
