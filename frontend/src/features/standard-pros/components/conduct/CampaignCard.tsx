import { CalendarClock, CircleOff, FileUp, Pencil, Play, SquarePen, Trash2, Users } from "lucide-react";
import type { CampaignStatsApi, SurveyCampaignApi } from "../../api/campaignApi";

interface CampaignCardProps {
  campaign: SurveyCampaignApi & { stats: CampaignStatsApi };
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
    draft: "bg-[#C9A227]/10 text-[#C9A227]",
    active: "bg-[#2DD4BF]/10 text-[#2DD4BF]",
    closed: "bg-[#E85A6B]/10 text-[#E85A6B]",
  } as const;

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-[#2A2A2F]/60 bg-[#0E0E11] px-3 py-2">
      <div className="text-xs font-semibold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[#5A5650]">
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
  const stats = campaign.stats;
  const link = campaign.publish_token ? `${window.location.origin}/survey/${campaign.publish_token}` : null;

  return (
    <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">{campaign.name}</h3>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="mt-1 text-xs text-[#C5C0B8]">
            {campaign.instrument?.abbreviation ?? "Unknown instrument"}
            {campaign.instrument?.name ? ` - ${campaign.instrument.name}` : ""}
          </p>
          {campaign.description && (
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#8A857D]">
              {campaign.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#5A5650]">
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8]"
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8] disabled:opacity-50"
              >
                <FileUp size={12} />
                Import
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onManualEntry(campaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8] disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8] disabled:opacity-50"
              >
                <Pencil size={12} />
                Edit
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onActivate(campaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-3 py-2 text-xs font-medium text-[#0E0E11] disabled:opacity-50"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E85A6B] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              <CircleOff size={12} />
              Close
            </button>
          )}
          <button
            type="button"
            disabled={isMutating}
            onClick={() => onDelete(campaign.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8] disabled:opacity-50"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Complete" value={String(stats.complete)} accent="#2DD4BF" />
        <Stat label="Pending" value={String(stats.pending)} accent="#C9A227" />
        <Stat label="Anonymous" value={String(stats.anonymous)} accent="#A78BFA" />
        <Stat label="Completion" value={`${stats.completion_rate}%`} accent="#60A5FA" />
        <div className="rounded-lg border border-[#2A2A2F]/60 bg-[#0E0E11] px-3 py-2">
          <div className="truncate text-[11px] text-[#C5C0B8]">
            {link ?? "Link available after activation"}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[#5A5650]">
            Publish Link
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#5A5650]">
          <span>Seeded completion progress</span>
          <span>{stats.complete}/{stats.seeded_total || 0}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#0E0E11]">
          <div
            className="h-full rounded-full bg-[#2DD4BF] transition-all"
            style={{ width: `${Math.max(0, Math.min(100, stats.completion_rate))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
