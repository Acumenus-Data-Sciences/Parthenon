import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVersions, useCreateVersion } from "../../hooks/useExport";

interface VersionHistoryProps {
  investigationId: number;
  investigationStatus: string;
}

export function VersionHistory({ investigationId, investigationStatus }: VersionHistoryProps) {
  const { t } = useTranslation("app");
  const { data: versions = [], isLoading } = useVersions(investigationId);
  const createVersion = useCreateVersion();

  const canCreate = investigationStatus !== "complete" && investigationStatus !== "archived";

  function handleCreate() {
    createVersion.mutate(investigationId);
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("investigation.common.sections.versionHistory")}
        </h3>
        {canCreate && (
          <button
            onClick={handleCreate}
            disabled={createVersion.isPending}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-accent disabled:opacity-50 disabled:cursor-not-allowed text-text-secondary text-xs font-medium transition-colors"
          >
            {createVersion.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : null}
            {t("investigation.common.actions.createSnapshot")}
          </button>
        )}
      </div>

      <p className="text-xs text-text-ghost">
        {t("investigation.common.messages.snapshotsAutoComplete")}
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-text-ghost">
          <Loader2 size={12} className="animate-spin" />
          {t("investigation.common.messages.loadingVersions")}
        </div>
      ) : versions.length === 0 ? (
        <p className="text-xs text-text-ghost">
          {t("investigation.common.empty.noSnapshotsYet")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between bg-surface-base/50 border border-border-default rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-surface-raised text-text-secondary">
                  v{v.version_number}
                </span>
                {v.creator && (
                  <span className="text-xs text-text-muted">{v.creator.name}</span>
                )}
              </div>
              <span className="text-xs text-text-ghost">
                {new Date(v.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
