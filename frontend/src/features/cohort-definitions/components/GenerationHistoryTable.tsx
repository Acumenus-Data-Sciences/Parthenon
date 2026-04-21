import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Ban,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortGenerations } from "../hooks/useCohortDefinitions";
import type { CohortGeneration } from "../types/cohortExpression";
import { useTranslation } from "react-i18next";

interface GenerationHistoryTableProps {
  definitionId: number | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: CohortGeneration["status"] }) {
  const { t } = useTranslation("app");
  const config = {
    pending: { icon: Clock, color: "var(--text-muted)", label: t("cohortDefinitions.auto.pending_2d13df") },
    queued: { icon: Clock, color: "var(--accent)", label: t("cohortDefinitions.auto.queued_7b2f31") },
    running: { icon: Loader2, color: "var(--info)", label: t("cohortDefinitions.auto.running_5bda81") },
    completed: { icon: CheckCircle2, color: "var(--success)", label: t("cohortDefinitions.auto.completed_07ca50") },
    failed: { icon: XCircle, color: "var(--critical)", label: t("cohortDefinitions.auto.failed_d7c8c8") },
    cancelled: { icon: Ban, color: "var(--text-muted)", label: t("cohortDefinitions.auto.cancelled_a149e8") },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
    >
      <Icon
        size={10}
        className={status === "running" ? "animate-spin" : ""}
      />
      {config.label}
    </span>
  );
}

export function GenerationHistoryTable({
  definitionId,
}: GenerationHistoryTableProps) {
  const { t } = useTranslation("app");
  const { data: generations, isLoading, error } =
    useCohortGenerations(definitionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-critical">
        {t("cohortDefinitions.auto.failedToLoadGenerationHistory_c966e7")}
      </div>
    );
  }

  if (!generations || generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-8">
        <AlertCircle size={20} className="text-text-ghost mb-2" />
        <p className="text-sm text-text-muted">{t("cohortDefinitions.auto.noGenerationsYet_38e4b5")}</p>
        <p className="mt-1 text-xs text-text-ghost">
          {t("cohortDefinitions.auto.generateTheCohortToSeeResultsHere_eb9c0a")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-surface-overlay">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {t("cohortDefinitions.auto.status_ec53a8")}
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {t("cohortDefinitions.auto.source_f31bbd")}
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {t("cohortDefinitions.auto.persons_cbb82b")}
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {t("cohortDefinitions.auto.started_842855")}
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {t("cohortDefinitions.auto.completed_07ca50")}
            </th>
          </tr>
        </thead>
        <tbody>
          {generations.map((gen, i) => (
            <tr
              key={gen.id}
              className={cn(
                "border-t border-border-subtle transition-colors",
                i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
              )}
            >
              <td className="px-4 py-3">
                <StatusBadge status={gen.status} />
              </td>
              <td className="px-4 py-3 text-xs text-text-muted">
                {t("cohortDefinitions.auto.source_1ec88c")}{gen.source_id}
              </td>
              <td className="px-4 py-3 text-right">
                {gen.person_count !== null ? (
                  <span className="inline-flex items-center gap-1 font-['IBM_Plex_Mono',monospace] text-sm font-medium text-success">
                    <Users size={12} />
                    {gen.person_count.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs text-text-ghost">--</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-text-muted">
                {formatDate(gen.started_at)}
              </td>
              <td className="px-4 py-3 text-xs text-text-muted">
                {formatDate(gen.completed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
