import {
  Database,
  Film,
  Image,
  HardDrive,
  Users,
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

const MODALITY_LABELS: Record<string, string> = {
  CT: "CT",
  MR: "MRI",
  PT: "PET",
  US: "Ultrasound",
  CR: "Computed Radiography",
  DX: "Digital X-Ray",
  MG: "Mammography",
  NM: "Nuclear Medicine",
  XA: "Angiography",
  RF: "Fluoroscopy",
  OT: "Other",
  SR: "Structured Report",
  DOC: "Document",
  SEG: "Segmentation",
  RTSTRUCT: "RT Structure",
  RTPLAN: "RT Plan",
  RTDOSE: "RT Dose",
  RTIMAGE: "RT Image",
  REG: "Registration",
  KO: "Key Object",
  PR: "Presentation State",
};

const STATUS_DOT: Record<string, string> = {
  ok: "bg-success",
  healthy: "bg-success",
  degraded: "bg-accent",
  error: "bg-critical",
  unreachable: "bg-critical",
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
        "rounded-xl border bg-surface-raised p-5 transition-colors",
        connection.is_default
          ? "border-accent/40"
          : "border-border-default",
        !connection.is_active && "opacity-50",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Status dot */}
          <span
            className={cn(
              "h-3 w-3 rounded-full flex-shrink-0",
              connection.last_health_status
                ? STATUS_DOT[connection.last_health_status] ?? "bg-text-ghost"
                : "bg-text-ghost",
            )}
          />
          <h3 className="text-base font-semibold text-text-primary truncate">
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
              size={16}
              className={cn(
                connection.is_default
                  ? "fill-accent text-accent"
                  : "text-text-ghost hover:text-accent",
                "transition-colors",
              )}
            />
          </button>
          {/* Type badge */}
          <span className="flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-success/15 text-success">
            {TYPE_LABELS[connection.type] ?? connection.type}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(connection)}
            title="Edit"
            className="p-2 rounded text-text-ghost hover:text-text-secondary hover:bg-surface-elevated transition-colors"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${connection.name}"?`)) onDelete(connection.id);
            }}
            title="Delete"
            className="p-2 rounded text-text-ghost hover:text-critical hover:bg-critical/10 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-5 gap-3">
        {[
          { label: "Patients", value: formatCount(stats?.count_patients), icon: Users },
          { label: "Studies", value: formatCount(stats?.count_studies), icon: Database },
          { label: "Series", value: formatCount(stats?.count_series), icon: Film },
          { label: "Instances", value: formatCount(stats?.count_instances), icon: Image },
          { label: "Disk", value: formatDiskMb(stats?.total_disk_size_mb), icon: HardDrive },
        ].map((cell) => (
          <div
            key={cell.label}
            className="rounded-lg bg-surface-base px-3 py-3 text-center"
          >
            <cell.icon size={16} className="mx-auto text-text-ghost mb-1.5" />
            <div className="text-sm font-semibold text-text-primary font-['IBM_Plex_Mono',monospace]">
              {cell.value}
            </div>
            <div className="text-xs text-text-muted mt-0.5">{cell.label}</div>
          </div>
        ))}
      </div>

      {/* Modality breakdown */}
      {stats?.modalities && Object.keys(stats.modalities).length > 0 && (
        <div className="mt-3 rounded-lg bg-surface-base px-4 py-3">
          <div className="text-xs font-medium text-text-muted mb-2">Series by Modality</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1.5">
            {Object.entries(stats.modalities).map(([mod, count]) => (
              <div key={mod} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-text-secondary truncate" title={MODALITY_LABELS[mod] ?? mod}>
                  {mod}
                  {MODALITY_LABELS[mod] && mod !== MODALITY_LABELS[mod] && (
                    <span className="ml-1.5 text-xs text-text-ghost">{MODALITY_LABELS[mod]}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-semibold text-success font-['IBM_Plex_Mono',monospace]">
                  {formatCount(count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-text-ghost">
          Stats updated {formatDate(connection.metadata_cached_at)}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onTest(connection.id)}
            disabled={isTesting}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40"
          >
            {isTesting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Test
          </button>
          <button
            type="button"
            onClick={() => onRefresh(connection.id)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40"
          >
            {isRefreshing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Stats
          </button>
          <button
            type="button"
            onClick={() => onBrowse(connection)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-success hover:bg-success/10 transition-colors"
          >
            <Search size={14} />
            Browse
          </button>
        </div>
      </div>
    </div>
  );
}
