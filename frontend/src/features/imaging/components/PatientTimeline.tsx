import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ScanLine, Pill, Ruler, ChevronRight, User, Calendar,
  Loader2, AlertCircle,
} from "lucide-react";
import type {
  PatientTimeline as TimelineData,
  TimelineStudy,
  DrugExposure,
  ImagingMeasurement,
} from "../types";
import { MultiTrendChart } from "./MeasurementTrendChart";
import ResponseAssessmentPanel from "./ResponseAssessmentPanel";

// ── Color Palette ───────────────────────────────────────────────────────

const MODALITY_COLORS: Record<string, string> = {
  CT: "#60A5FA",
  MR: "#A78BFA",
  PT: "#F59E0B",
  US: "#2DD4BF",
  CR: "#8A857D",
  DX: "#8A857D",
  NM: "#F472B6",
};

const DRUG_COLORS = [
  "#E85A6B", "#60A5FA", "#2DD4BF", "#F59E0B", "#A78BFA",
  "#F472B6", "#34D399", "#FB923C", "#818CF8", "#C084FC",
];

const MEASUREMENT_TYPE_LABELS: Record<string, string> = {
  tumor_volume: "Tumor Volume",
  suvmax: "SUVmax",
  opacity_score: "Opacity Score",
  lesion_count: "Lesion Count",
  longest_diameter: "Longest Diameter",
  perpendicular_diameter: "Perpendicular Diameter",
  density_hu: "Density (HU)",
  ground_glass_extent: "Ground Glass Extent",
  consolidation_extent: "Consolidation Extent",
  ct_severity_score: "CT Severity Score",
  metabolic_tumor_volume: "Metabolic Tumor Volume",
  total_lesion_glycolysis: "Total Lesion Glycolysis",
};

// ── Helper: Parse date ──────────────────────────────────────────────────

function toTimestamp(dateStr: string | null): number {
  return dateStr ? new Date(dateStr).getTime() : 0;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Summary Cards ───────────────────────────────────────────────────────

function SummaryCards({ data }: { data: TimelineData }) {
  const { summary, person } = data;
  const age = person.year_of_birth
    ? new Date().getFullYear() - person.year_of_birth
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Demographics */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={14} className="text-[#A78BFA]" />
          <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">Patient</span>
        </div>
        <p className="text-sm text-[#F0EDE8] font-semibold font-mono">
          Person {person.person_id}
        </p>
        <p className="text-xs text-[#8A857D] mt-1">
          {[person.gender, age ? `${age}y` : null, person.race].filter(Boolean).join(" · ") || "Demographics unavailable"}
        </p>
      </div>

      {/* Studies */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center gap-2 mb-2">
          <ScanLine size={14} className="text-[#60A5FA]" />
          <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">Studies</span>
        </div>
        <p className="text-lg text-[#60A5FA] font-semibold font-mono">
          {summary.total_studies}
        </p>
        <p className="text-xs text-[#8A857D] mt-1">
          {summary.modalities.join(", ") || "—"} · {summary.imaging_span_days ? `${summary.imaging_span_days}d span` : "single study"}
        </p>
      </div>

      {/* Measurements */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Ruler size={14} className="text-[#2DD4BF]" />
          <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">Measurements</span>
        </div>
        <p className="text-lg text-[#2DD4BF] font-semibold font-mono">
          {summary.total_measurements}
        </p>
        <p className="text-xs text-[#8A857D] mt-1">
          {summary.measurement_types.length > 0
            ? summary.measurement_types.map(t => MEASUREMENT_TYPE_LABELS[t] ?? t).join(", ")
            : "No measurements yet"}
        </p>
      </div>

      {/* Drug exposures */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Pill size={14} className="text-[#F59E0B]" />
          <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">Treatments</span>
        </div>
        <p className="text-lg text-[#F59E0B] font-semibold font-mono">
          {summary.total_drugs}
        </p>
        <p className="text-xs text-[#8A857D] mt-1">
          {summary.date_range.first && summary.date_range.last
            ? `${formatDate(summary.date_range.first)} – ${formatDate(summary.date_range.last)}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

// ── Visual Timeline ─────────────────────────────────────────────────────

function VisualTimeline({ data }: { data: TimelineData }) {
  const { studies, drug_exposures, measurements } = data;

  // Compute time axis from all dates
  const allDates = useMemo(() => {
    const dates: number[] = [];
    studies.forEach(s => { if (s.study_date) dates.push(toTimestamp(s.study_date)); });
    drug_exposures.forEach(d => {
      dates.push(toTimestamp(d.start_date));
      if (d.end_date) dates.push(toTimestamp(d.end_date));
    });
    return dates;
  }, [studies, drug_exposures]);

  const minTime = Math.min(...allDates);
  const maxTime = Math.max(...allDates);
  const range = maxTime - minTime || 1;

  // Group measurements by study_id
  const measurementsByStudy = useMemo(() => {
    const map = new Map<number, ImagingMeasurement[]>();
    measurements.forEach(m => {
      const arr = map.get(m.study_id) || [];
      arr.push(m);
      map.set(m.study_id, arr);
    });
    return map;
  }, [measurements]);

  function xPos(dateStr: string | null): number {
    if (!dateStr) return 0;
    return ((toTimestamp(dateStr) - minTime) / range) * 100;
  }

  if (studies.length === 0) {
    return (
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-8 text-center text-sm text-[#5A5650]">
        No imaging studies found for this patient.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-6 space-y-6">
      <h3 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-2">
        <Calendar size={14} className="text-[#60A5FA]" />
        Longitudinal Timeline
      </h3>

      {/* Drug exposure bars */}
      {drug_exposures.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">Treatment Context</p>
          <div className="relative" style={{ height: drug_exposures.length * 28 + 4 }}>
            {drug_exposures.map((drug, i) => {
              const left = xPos(drug.start_date);
              const right = xPos(drug.end_date);
              const width = Math.max(right - left, 0.5);
              const color = DRUG_COLORS[i % DRUG_COLORS.length];

              return (
                <div
                  key={`${drug.drug_concept_id}-${i}`}
                  className="absolute flex items-center"
                  style={{ top: i * 28, left: `${left}%`, width: `${width}%`, height: 22 }}
                >
                  <div
                    className="h-full rounded-md opacity-60 min-w-[4px]"
                    style={{ backgroundColor: color, width: "100%" }}
                    title={`${drug.drug_name}\n${formatDate(drug.start_date)} – ${formatDate(drug.end_date)}\n${drug.total_days}d supply`}
                  />
                  <span
                    className="absolute left-1 text-[9px] font-medium truncate pointer-events-none"
                    style={{ color, maxWidth: "90%" }}
                  >
                    {drug.drug_name.length > 40 ? drug.drug_name.slice(0, 37) + "…" : drug.drug_name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Study nodes on timeline axis */}
      <div className="space-y-2">
        <p className="text-[10px] text-[#5A5650] uppercase tracking-wider">Imaging Studies</p>
        <div className="relative h-16">
          {/* Axis line */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-[#2A2A30]" />

          {studies.map((study, i) => {
            const left = xPos(study.study_date);
            const color = MODALITY_COLORS[study.modality ?? ""] ?? "#8A857D";
            const studyMeasurements = measurementsByStudy.get(study.id) ?? [];

            return (
              <Link
                key={study.id}
                to={`/imaging/studies/${study.id}`}
                className="absolute -translate-x-1/2 flex flex-col items-center gap-1 group"
                style={{ left: `${left}%`, top: 0 }}
                title={`${study.modality ?? "?"} · ${study.study_description ?? "No description"}\n${formatDate(study.study_date)}\n${study.num_series} series · ${study.num_images} images\n${studyMeasurements.length} measurements`}
              >
                {/* Node */}
                <div
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-125"
                  style={{ borderColor: color, backgroundColor: `${color}22` }}
                >
                  <ScanLine size={14} style={{ color }} />
                </div>
                {/* Date label */}
                <span className="text-[9px] text-[#5A5650] whitespace-nowrap">
                  {study.study_date ? new Date(study.study_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "?"}
                </span>
                {/* Measurement indicator */}
                {studyMeasurements.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2DD4BF] text-[8px] font-bold text-[#0E0E11] flex items-center justify-center">
                    {studyMeasurements.length}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Measurement trends (Recharts) */}
      {measurements.length > 0 && (
        <MultiTrendChart measurements={measurements} />
      )}
    </div>
  );
}

// ── Study List Table ────────────────────────────────────────────────────

function StudyListTable({ studies }: { studies: TimelineStudy[] }) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518]">
      <div className="px-4 py-3 border-b border-[#232328]">
        <h3 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-2">
          <ScanLine size={14} className="text-[#60A5FA]" />
          All Studies ({studies.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#232328]">
              {["Date", "Modality", "Body Part", "Description", "Series", "Images", "Measurements", ""].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-[#5A5650] uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E1E23]">
            {studies.map(study => (
              <tr key={study.id} className="hover:bg-[#1A1A1F] transition-colors">
                <td className="px-4 py-3 text-[#C5C0B8] text-xs">{formatDate(study.study_date)}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${MODALITY_COLORS[study.modality ?? ""] ?? "#8A857D"}18`,
                      color: MODALITY_COLORS[study.modality ?? ""] ?? "#8A857D",
                    }}
                  >
                    {study.modality ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#8A857D] text-xs">{study.body_part_examined ?? "—"}</td>
                <td className="px-4 py-3 text-[#8A857D] text-xs max-w-xs truncate">{study.study_description ?? "—"}</td>
                <td className="px-4 py-3 text-[#C5C0B8] text-xs text-center">{study.num_series}</td>
                <td className="px-4 py-3 text-[#C5C0B8] text-xs text-center">{study.num_images}</td>
                <td className="px-4 py-3 text-center">
                  {study.measurement_count > 0 ? (
                    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
                      {study.measurement_count}
                    </span>
                  ) : (
                    <span className="text-[#5A5650] text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/imaging/studies/${study.id}`}
                    className="inline-flex items-center gap-1 text-xs text-[#2DD4BF] hover:text-[#26B8A5] transition-colors"
                  >
                    View <ChevronRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Drug Exposure Table ─────────────────────────────────────────────────

function DrugExposureTable({ drugs }: { drugs: DrugExposure[] }) {
  if (drugs.length === 0) {
    return (
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-6 text-center text-sm text-[#5A5650]">
        No drug exposures found in the imaging window.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518]">
      <div className="px-4 py-3 border-b border-[#232328]">
        <h3 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-2">
          <Pill size={14} className="text-[#F59E0B]" />
          Treatment Context ({drugs.length} drugs)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#232328]">
              {["Drug Name", "Class", "Start", "End", "Days Supply"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-[#5A5650] uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E1E23]">
            {drugs.map((drug, i) => (
              <tr key={`${drug.drug_concept_id}-${i}`} className="hover:bg-[#1A1A1F] transition-colors">
                <td className="px-4 py-3 text-[#F0EDE8] text-xs font-medium max-w-xs truncate">{drug.drug_name}</td>
                <td className="px-4 py-3 text-[#8A857D] text-xs">{drug.drug_class ?? "—"}</td>
                <td className="px-4 py-3 text-[#C5C0B8] text-xs">{formatDate(drug.start_date)}</td>
                <td className="px-4 py-3 text-[#C5C0B8] text-xs">{formatDate(drug.end_date)}</td>
                <td className="px-4 py-3 text-[#C5C0B8] text-xs font-mono">{drug.total_days}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

interface PatientTimelineProps {
  data: TimelineData;
  isLoading?: boolean;
  error?: Error | null;
}

export default function PatientTimeline({ data, isLoading, error }: PatientTimelineProps) {
  const [showDrugs, setShowDrugs] = useState(true);
  const [showAssessments, setShowAssessments] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/10 p-6 flex items-center gap-3">
        <AlertCircle size={18} className="text-[#E85A6B] flex-shrink-0" />
        <p className="text-sm text-[#E85A6B]">Failed to load patient timeline: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryCards data={data} />
      <VisualTimeline data={data} />

      {/* Toggle buttons */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowDrugs(!showDrugs)}
          className="text-xs text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          {showDrugs ? "Hide" : "Show"} treatment details ({data.drug_exposures.length})
        </button>
        <button
          type="button"
          onClick={() => setShowAssessments(!showAssessments)}
          className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
        >
          {showAssessments ? "Hide" : "Show"} response assessments
        </button>
      </div>

      {showDrugs && <DrugExposureTable drugs={data.drug_exposures} />}

      {showAssessments && (
        <ResponseAssessmentPanel personId={data.person.person_id} studies={data.studies} />
      )}

      <StudyListTable studies={data.studies} />
    </div>
  );
}
