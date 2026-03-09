import {
  Database,
  Film,
  Image,
  HardDrive,
  Star,
  Pencil,
  Trash2,
  RefreshCw,
  Play,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PacsConnection } from "../api/pacsApi";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number | null | undefined): string {
  if (n == null) return "--";
  return n.toLocaleString();
}

function formatDiskMb(mb: number | null | undefined): string {
  if (mb == null) return "--";
  if (mb === 0) return "0 MB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_LABELS: Record<string, string> = {
  orthanc: "Orthanc",
  dicomweb: "DICOMweb",
  google_healthcare: "Google Healthcare",
  cloud: "Cloud",
};

const STATUS_DOT: Record<string, string> = {
  ok: "bg-[#2DD4BF]",
  healthy: "bg-[#2DD4BF]",
  degraded: "bg-[#C9A227]",
  error: "bg-[#E85A6B]",
  unreachable: "bg-[#E85A6B]",
};

// ── Component ────────────────────────────────────────────────────────────────

interface PacsConnectionCardProps {
  connection: PacsConnection;
  onTest: (id: number) => void;
  onRefresh: (id: number) => void;
  onEdit: (conn: PacsConnection) => void;
  onDelete: (id: number) => void;
  onBrowse: (conn: PacsConnection) => void;
  onSetDefault: (id: number) => void;
  isTesting?: boolean;
  isRefreshing?: boolean;
}

export default function PacsConnectionCard({
  connection,
  onTest,
  onRefresh,
  onEdit,
  onDelete,
  onBrowse,
  onSetDefault,
  isTesting,
  isRefreshing,
}: PacsConnectionCardProps) {
  const stats = connection.metadata_cache;

  return (
    <div
      className={cn(
        "rounded-xl border bg-[#151518] p-4 transition-colors",
        connection.is_default
          ? "border-[#C9A227]/40"
          : "border-[#232328]",
        !connection.is_active && "opacity-50",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Status dot */}
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full flex-shrink-0",
              connection.last_health_status
                ? STATUS_DOT[connection.last_health_status] ?? "bg-[#5A5650]"
                : "bg-[#5A5650]",
            )}
          />
          <h3 className="text-sm font-semibold text-[#F0EDE8] truncate">
            {connection.name}
          </h3>
          {/* Default star */}
          <button
            type="button"
            onClick={() => onSetDefault(connection.id)}
            title={connection.is_default ? "Default connection" : "Set as default"}
            className="flex-shrink-0"
          >
            <Star
              size={14}
              className={cn(
                connection.is_default
                  ? "fill-[#C9A227] text-[#C9A227]"
                  : "text-[#5A5650] hover:text-[#C9A227]",
                "transition-colors",
              )}
            />
          </button>
          {/* Type badge */}
          <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
            {TYPE_LABELS[connection.type] ?? connection.type}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(connection)}
            title="Edit"
            className="p-1.5 rounded text-[#5A5650] hover:text-[#C5C0B8] hover:bg-[#232328] transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${connection.name}"?`)) onDelete(connection.id);
            }}
            title="Delete"
            className="p-1.5 rounded text-[#5A5650] hover:text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          { label: "Studies", value: formatCount(stats?.count_studies), icon: Database },
          { label: "Series", value: formatCount(stats?.count_series), icon: Film },
          { label: "Instances", value: formatCount(stats?.count_instances), icon: Image },
          { label: "Disk", value: formatDiskMb(stats?.total_disk_size_mb), icon: HardDrive },
        ].map((cell) => (
          <div
            key={cell.label}
            className="rounded-lg bg-[#0E0E11] px-2.5 py-2 text-center"
          >
            <cell.icon size={12} className="mx-auto text-[#5A5650] mb-1" />
            <div className="text-xs font-medium text-[#F0EDE8] font-['IBM_Plex_Mono',monospace]">
              {cell.value}
            </div>
            <div className="text-[10px] text-[#5A5650]">{cell.label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[#5A5650]">
          Stats updated {formatDate(connection.metadata_cached_at)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTest(connection.id)}
            disabled={isTesting}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40"
          >
            {isTesting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Test
          </button>
          <button
            type="button"
            onClick={() => onRefresh(connection.id)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40"
          >
            {isRefreshing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Stats
          </button>
          <button
            type="button"
            onClick={() => onBrowse(connection)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[#2DD4BF] hover:bg-[#2DD4BF]/10 transition-colors"
          >
            <Search size={12} />
            Browse
          </button>
        </div>
      </div>
    </div>
  );
}
