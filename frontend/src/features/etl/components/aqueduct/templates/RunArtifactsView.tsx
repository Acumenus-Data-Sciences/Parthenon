import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TemplateRunArtifact } from "../../../types/templates";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export interface RunArtifactsViewProps {
  artifacts: TemplateRunArtifact[];
}

export function RunArtifactsView({ artifacts }: RunArtifactsViewProps) {
  const { t } = useTranslation("app");
  if (artifacts.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised p-6 text-center text-sm text-text-muted">
        {t("aqueduct.runInspector.noArtifacts", {
          defaultValue: "No artifacts produced by this run.",
        })}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border-default rounded-lg border border-border-default bg-surface-raised">
      {artifacts.map((a) => (
        <li
          key={a.name}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <a
              href={a.signed_url}
              download={a.name}
              className="flex items-center gap-2 text-sm font-medium text-text-primary hover:text-success"
            >
              <Download size={14} className="text-success" />
              <span className="truncate">{a.name}</span>
            </a>
            <p className="mt-0.5 text-xs text-text-ghost">{a.content_type}</p>
          </div>
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
            {formatBytes(a.size_bytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}
