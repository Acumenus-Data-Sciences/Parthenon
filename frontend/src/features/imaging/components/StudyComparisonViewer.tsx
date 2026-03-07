/**
 * StudyComparisonViewer — Side-by-side OHIF viewers for baseline vs follow-up.
 * Critical for treatment response assessment (RECIST, RANO).
 */

import { useState } from "react";
import { X, Columns2, ArrowLeftRight, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import OhifViewer from "./OhifViewer";
import type { ImagingStudy, TimelineStudy } from "../types";

type AnyStudy = TimelineStudy | ImagingStudy;

const MODALITY_COLORS: Record<string, string> = {
  CT: "#60A5FA", MR: "#A78BFA", PT: "#F59E0B", US: "#2DD4BF",
  CR: "#8A857D", DX: "#8A857D", NM: "#F472B6",
};

function formatDate(d: string | null): string {
  if (!d) return "Unknown";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getStudyDate(s: AnyStudy): string | null {
  return "study_date" in s ? (s.study_date as string | null) : null;
}

interface StudyComparisonViewerProps {
  baseline: AnyStudy;
  followUp: AnyStudy;
  onClose: () => void;
  onSwap?: () => void;
}

export default function StudyComparisonViewer({
  baseline,
  followUp,
  onClose,
  onSwap,
}: StudyComparisonViewerProps) {
  const [layout, setLayout] = useState<"side" | "stack">("side");

  const baselineDate = getStudyDate(baseline);
  const followUpDate = getStudyDate(followUp);

  // Calculate days between studies
  const daysBetween = baselineDate && followUpDate
    ? Math.round((new Date(followUpDate).getTime() - new Date(baselineDate).getTime()) / 86400000)
    : null;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/5 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Columns2 size={14} className="text-[#C9A227]" />
          <span className="text-sm font-semibold text-[#F0EDE8]">Study Comparison</span>
          {daysBetween !== null && (
            <span className="text-[10px] text-[#C9A227] bg-[#C9A227]/10 px-2 py-0.5 rounded">
              {daysBetween}d interval
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onSwap && (
            <button
              type="button"
              onClick={onSwap}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors"
            >
              <ArrowLeftRight size={10} /> Swap
            </button>
          )}
          <button
            type="button"
            onClick={() => setLayout(layout === "side" ? "stack" : "side")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors"
          >
            <Maximize2 size={10} /> {layout === "side" ? "Stack" : "Side-by-side"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
          >
            <X size={10} /> Close
          </button>
        </div>
      </div>

      {/* Viewers */}
      <div className={cn(
        "gap-3",
        layout === "side" ? "grid grid-cols-2" : "space-y-3",
      )}>
        {/* Baseline */}
        <div className="space-y-1.5">
          <StudyLabel
            label="Baseline"
            study={baseline}
            color="#60A5FA"
          />
          <OhifViewer
            studyInstanceUid={baseline.study_instance_uid}
            studyId={baseline.id}
          />
        </div>

        {/* Follow-up */}
        <div className="space-y-1.5">
          <StudyLabel
            label="Follow-up"
            study={followUp}
            color="#2DD4BF"
          />
          <OhifViewer
            studyInstanceUid={followUp.study_instance_uid}
            studyId={followUp.id}
          />
        </div>
      </div>
    </div>
  );
}

function StudyLabel({ label, study, color }: { label: string; study: AnyStudy; color: string }) {
  const modColor = MODALITY_COLORS[study.modality ?? ""] ?? "#8A857D";
  return (
    <div className="flex items-center gap-2 px-1">
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {label}
      </span>
      <span
        className="text-[10px] font-semibold"
        style={{ color: modColor }}
      >
        {study.modality ?? "?"}
      </span>
      <span className="text-[10px] text-[#8A857D] truncate max-w-[200px]">
        {study.study_description ?? study.body_part_examined ?? "—"}
      </span>
      <span className="text-[10px] text-[#5A5650] ml-auto">
        {formatDate(getStudyDate(study))}
      </span>
    </div>
  );
}
