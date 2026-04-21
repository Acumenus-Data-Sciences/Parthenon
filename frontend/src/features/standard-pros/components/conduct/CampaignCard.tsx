import { CalendarClock, CircleOff, FileUp, Pencil, Play, SquarePen, Trash2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CampaignStatsApi, SurveyCampaignApi } from "../../api/campaignApi";

interface CampaignCardProps {
  campaign: SurveyCampaignApi;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
  onImport: (id: number) => void;
  onManualEntry: (id: number) => void;
  isMutating?: boolean;
}

function StatusBadge({ status }: { status: SurveyCampaignApi["status"] }) {
  const { t } = useTranslation("app");
  const styles = {
    draft: "bg-accent/10 text-accent",
    active: "bg-success/10 text-success",
    closed: "bg-critical/10 text-critical",
  } as const;

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}>
      {t(`standardPros.conduct.filters.${status}`)}
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-border-default/60 bg-surface-base px-3 py-2">
      <div className="text-xs font-semibold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-ghost">
        {label}
      </div>
    </div>
  );
}

export function CampaignCard({
  campaign,
  onActivate,
  onClose,
  onDelete,
  onEdit,
  onImport,
  onManualEntry,
  isMutating = false,
}: CampaignCardProps) {
  const { t } = useTranslation("app");
  const stats: CampaignStatsApi = campaign.stats ?? {
    seeded_total: 0,
    complete: 0,
    pending: 0,
    anonymous: 0,
    completion_rate: 0,
  };
  const link = campaign.publish_token ? `${window.location.origin}/survey/${campaign.publish_token}` : null;

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{campaign.name}</h3>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {campaign.instrument?.abbreviation ?? t("standardPros.conduct.unknownInstrument")}
            {campaign.instrument?.name ? ` - ${campaign.instrument.name}` : ""}
          </p>
          {campaign.description && (
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-text-muted">
              {campaign.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-text-ghost">
            <span className="inline-flex items-center gap-1.5">
              <Users size={12} />
              {t("standardPros.conduct.seededDenominator")}: {stats.seeded_total}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={12} />
              {t("standardPros.conduct.created", {
                date: new Date(campaign.created_at).toLocaleDateString(),
              })}
            </span>
            {campaign.closed_at && (
              <span className="inline-flex items-center gap-1.5">
                <CircleOff size={12} />
                {t("standardPros.conduct.closedAt", {
                  date: new Date(campaign.closed_at).toLocaleDateString(),
                })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary"
            >
              {t("standardPros.common.openLink")}
            </a>
          )}
          {campaign.status === "active" && (
            <>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onImport(campaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                <FileUp size={12} />
                {t("standardPros.common.import")}
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onManualEntry(campaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                <SquarePen size={12} />
                {t("standardPros.common.proxyEntry")}
              </button>
            </>
          )}
          {campaign.status === "draft" && (
            <>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onEdit(campaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                <Pencil size={12} />
                {t("standardPros.common.edit")}
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onActivate(campaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-medium text-surface-base disabled:opacity-50"
              >
                <Play size={12} />
                {t("standardPros.common.activate")}
              </button>
            </>
          )}
          {campaign.status === "active" && (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onClose(campaign.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-critical px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              <CircleOff size={12} />
              {t("standardPros.common.close")}
            </button>
          )}
          <button
            type="button"
            disabled={isMutating}
            onClick={() => onDelete(campaign.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
          >
            <Trash2 size={12} />
            {t("standardPros.common.delete")}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t("standardPros.common.complete")} value={String(stats.complete)} accent="var(--success)" />
        <Stat label={t("standardPros.common.pending")} value={String(stats.pending)} accent="var(--accent)" />
        <Stat label={t("standardPros.common.anonymous")} value={String(stats.anonymous)} accent="var(--domain-observation)" />
        <Stat label={t("standardPros.common.completion")} value={`${stats.completion_rate}%`} accent="var(--info)" />
        <div className="rounded-lg border border-border-default/60 bg-surface-base px-3 py-2">
          <div className="truncate text-[11px] text-text-secondary">
            {link ?? t("standardPros.conduct.linkAvailableAfterActivation")}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-ghost">
            {t("standardPros.conduct.publishLink")}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-text-ghost">
          <span>{t("standardPros.conduct.seededCompletionProgress")}</span>
          <span>{stats.complete}/{stats.seeded_total || 0}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-base">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${Math.max(0, Math.min(100, stats.completion_rate))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
