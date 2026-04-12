import { CalendarClock, CircleOff, FileUp, Pencil, Play, SquarePen, Trash2, Users } from "lucide-react";
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
  const styles = {
    draft: "bg-accent/10 text-accent",
    active: "bg-success/10 text-success",
    closed: "bg-critical/10 text-critical",
  } as const;

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}>
      {status}
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
            {campaign.instrument?.abbreviation ?? "Unknown instrument"}
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
              Seeded denominator: {stats.seeded_total}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={12} />
              Created {new Date(campaign.created_at).toLocaleDateString()}
            </span>
            {campaign.closed_at && (
              <span className="inline-flex items-center gap-1.5">
                <CircleOff size={12} />
                Closed {new Date(campaign.closed_at).toLocaleDateString()}
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
              Open Link
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
                Import
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onManualEntry(campaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                <SquarePen size={12} />
                Proxy Entry
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
                Edit
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onActivate(campaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-medium text-surface-base disabled:opacity-50"
              >
                <Play size={12} />
                Activate
              </button>
            </>
          )}
          {campaign.status === "active" && (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onClose(campaign.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-critical px-3 py-2 text-xs font-medium text-text-primary disabled:opacity-50"
            >
              <CircleOff size={12} />
              Close
            </button>
          )}
          <button
            type="button"
            disabled={isMutating}
            onClick={() => onDelete(campaign.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Complete" value={String(stats.complete)} accent="var(--success)" />
        <Stat label="Pending" value={String(stats.pending)} accent="var(--accent)" />
        <Stat label="Anonymous" value={String(stats.anonymous)} accent="var(--domain-observation)" />
        <Stat label="Completion" value={`${stats.completion_rate}%`} accent="var(--info)" />
        <div className="rounded-lg border border-border-default/60 bg-surface-base px-3 py-2">
          <div className="truncate text-[11px] text-text-secondary">
            {link ?? "Link available after activation"}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-ghost">
            Publish Link
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-text-ghost">
          <span>Seeded completion progress</span>
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
