/**
 * StudyBrowser — Grid of imaging study cards with filtering by modality/date.
 * Supports optional side-by-side comparison mode.
 */

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ScanLine, Monitor, Ruler, ChevronDown, Filter,
  Loader2, Columns2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImagingStudy, TimelineStudy } from "../types";

type AnyStudy = TimelineStudy | ImagingStudy;

const MODALITY_COLORS: Record<string, string> = {
  CT: "var(--info)", MR: "var(--domain-observation)", PT: "var(--warning)", US: "var(--success)",
  CR: "var(--text-muted)", DX: "var(--text-muted)", NM: "var(--domain-procedure)",
};

function formatDate(d: string | null): string {
  if (!d) return "Unknown";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getStudyDate(s: AnyStudy): string | null {
  return "study_date" in s ? (s.study_date as string | null) : null;
}

function getMeasurementCount(s: AnyStudy): number {
  if ("measurement_count" in s) return (s as TimelineStudy).measurement_count;
  if ("measurements_count" in s) return (s as ImagingStudy).measurements_count ?? 0;
  return 0;
}

// ── Study Card ──────────────────────────────────────────────────────────

function StudyCard({ study, onCompare, compareSelected }: {
  study: AnyStudy;
  onCompare?: (s: AnyStudy) => void;
  compareSelected?: boolean;
}) {
  const color = MODALITY_COLORS[study.modality ?? ""] ?? "var(--text-muted)";
  const mc = getMeasurementCount(study);

  return (
    <div className={cn(
      "group rounded-lg border bg-surface-raised overflow-hidden transition-all hover:border-surface-highlight",
      compareSelected ? "border-accent ring-1 ring-[#C9A227]/30" : "border-border-default",
    )}>
      {/* Thumbnail placeholder */}
      <div className="relative aspect-[4/3] bg-surface-base flex items-center justify-center">
        <ScanLine size={28} className="text-surface-overlay" />

        {/* Modality badge */}
        <div
          className="absolute top-2 left-2 rounded px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {study.modality ?? "?"}
        </div>

        {mc > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5">
            <Ruler size={9} className="text-success" />
            <span className="text-[9px] font-semibold text-success">{mc}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Link
            to={`/imaging/studies/${study.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-surface-base hover:bg-success-dark"
          >
            <ScanLine size={12} /> Details
          </Link>
          <a
            href={`/ohif/viewer?StudyInstanceUIDs=${encodeURIComponent(study.study_instance_uid)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-surface-base hover:bg-info"
          >
            <Monitor size={12} /> OHIF
          </a>
          {onCompare && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCompare(study); }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                compareSelected
                  ? "bg-accent text-surface-base"
                  : "bg-surface-elevated text-text-secondary hover:bg-surface-accent",
              )}
            >
              <Columns2 size={12} /> {compareSelected ? "Selected" : "Compare"}
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-1">
        <p className="text-xs font-medium text-text-primary truncate">
          {study.study_description ?? study.body_part_examined ?? "DICOM Study"}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-text-ghost">{formatDate(getStudyDate(study))}</p>
          <p className="text-[10px] text-text-ghost">{study.num_series}s · {study.num_images}i</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

interface StudyBrowserProps {
  studies: AnyStudy[];
  isLoading?: boolean;
  onCompareSelect?: (pair: [AnyStudy, AnyStudy]) => void;
  title?: string;
}

export default function StudyBrowser({ studies, isLoading, onCompareSelect, title }: StudyBrowserProps) {
  const [modalityFilter, setModalityFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "modality">("date");
  const [compareSelection, setCompareSelection] = useState<AnyStudy[]>([]);

  const modalities = useMemo(() => {
    const set = new Set<string>();
    studies.forEach((s) => { if (s.modality) set.add(s.modality); });
    return Array.from(set).sort();
  }, [studies]);

  const filtered = useMemo(() => {
    const result = modalityFilter === "all"
      ? [...studies]
      : studies.filter((s) => s.modality === modalityFilter);

    if (sortBy === "date") {
      result.sort((a, b) => (getStudyDate(b) ?? "").localeCompare(getStudyDate(a) ?? ""));
    } else {
      result.sort((a, b) => (a.modality ?? "").localeCompare(b.modality ?? ""));
    }
    return result;
  }, [studies, modalityFilter, sortBy]);

  const handleCompareToggle = (study: AnyStudy) => {
    setCompareSelection((prev) => {
      if (prev.find((s) => s.id === study.id)) {
        return prev.filter((s) => s.id !== study.id);
      }
      const next = [...prev, study].slice(-2);
      if (next.length === 2 && onCompareSelect) {
        onCompareSelect(next as [AnyStudy, AnyStudy]);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-info" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <ScanLine size={14} className="text-info" />
          {title ?? `Imaging Studies (${studies.length})`}
        </h3>

        <div className="flex items-center gap-2">
          {modalities.length > 1 && (
            <div className="relative">
              <Filter size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-ghost" />
              <select
                value={modalityFilter}
                onChange={(e) => setModalityFilter(e.target.value)}
                className="appearance-none rounded-md border border-border-default bg-surface-base pl-7 pr-6 py-1.5 text-[10px] text-text-secondary focus:outline-none focus:border-info"
              >
                <option value="all">All ({studies.length})</option>
                {modalities.map((m) => (
                  <option key={m} value={m}>
                    {m} ({studies.filter((s) => s.modality === m).length})
                  </option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost pointer-events-none" />
            </div>
          )}

          <div className="flex items-center gap-0.5 rounded-md border border-border-default bg-surface-base p-0.5">
            {(["date", "modality"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                className={cn(
                  "px-2.5 py-1 text-[10px] rounded transition-colors",
                  sortBy === s ? "bg-info/10 text-info font-medium" : "text-text-ghost hover:text-text-muted",
                )}
              >
                {s === "date" ? "Date" : "Modality"}
              </button>
            ))}
          </div>

          {onCompareSelect && compareSelection.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-accent">
              <Columns2 size={10} />
              {compareSelection.length}/2
              <button
                type="button"
                onClick={() => setCompareSelection([])}
                className="text-text-ghost hover:text-text-muted ml-1"
              >
                clear
              </button>
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
          <p className="text-sm text-text-ghost">No imaging studies found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((study) => (
            <StudyCard
              key={study.id}
              study={study}
              onCompare={onCompareSelect ? handleCompareToggle : undefined}
              compareSelected={compareSelection.some((s) => s.id === study.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
