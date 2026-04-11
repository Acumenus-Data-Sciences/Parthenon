import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, FlaskConical, Pill, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { DimensionScoreBar } from "./DimensionScoreBar";
import type { SimilarPatient, SharedFeatureCategory } from "../types/patientSimilarity";

interface SimilarPatientTableProps {
  patients: SimilarPatient[];
  showPersonId: boolean;
  seedPersonId?: number;
  sourceId?: number;
}

function normalizeScore(score: number | null | undefined): number | null {
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function formatGender(genderConceptId: number | undefined): string {
  if (genderConceptId === 8507) return "M";
  if (genderConceptId === 8532) return "F";
  return "?";
}

function formatPatientSummary(patient: SimilarPatient): string {
  const parts: string[] = [];
  if (patient.gender_concept_id != null || patient.age_bucket != null) {
    const g = formatGender(patient.gender_concept_id);
    const age = patient.age_bucket != null ? `${patient.age_bucket * 5}-${patient.age_bucket * 5 + 4}y` : "?y";
    parts.push(`${g}, ${age}`);
  }
  return parts.join(" \u00B7 ") || "\u2014";
}

function getOverallScoreColor(score: number): string {
  if (score >= 0.8) return "#2DD4BF";
  if (score >= 0.5) return "#C9A227";
  return "#8A857D";
}

function formatAnchorDate(value: string | null | undefined): string {
  if (!value) return "\u2014";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SharedFeaturePills({ category, icon, label }: {
  category?: SharedFeatureCategory | null;
  icon: React.ReactNode;
  label: string;
}) {
  const sharedCount = category?.shared_count ?? 0;
  const seedCount = category?.seed_count ?? 0;
  const topShared = Array.isArray(category?.top_shared) ? category.top_shared : [];
  const recentSharedCount = category?.recent_shared_count ?? 0;
  const recentTopShared = Array.isArray(category?.recent_top_shared)
    ? category.recent_top_shared
    : [];

  if (sharedCount === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
        {icon}
        {label}
        <span className="text-[#8A857D] font-normal normal-case">
          ({sharedCount} of {seedCount} lifetime shared)
        </span>
        {recentSharedCount > 0 && (
          <span className="rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-1.5 py-0.5 text-[9px] text-[#2DD4BF] normal-case tracking-normal">
            {recentSharedCount} recent
          </span>
        )}
      </div>
      {recentSharedCount > 0 && recentTopShared.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-[#5A5650] uppercase tracking-wider">
            Recent overlap
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentTopShared.map((concept) => (
              <span
                key={`recent-${concept.concept_id}`}
                className="inline-flex items-center rounded-md bg-[#13211E] border border-[#2DD4BF]/20 px-2 py-0.5 text-xs text-[#A7F3D0]"
                title={`Concept ID: ${concept.concept_id}`}
              >
                {concept.name}
              </span>
            ))}
            {recentSharedCount > recentTopShared.length && (
              <span className="inline-flex items-center text-[10px] text-[#5A5650] px-1">
                +{recentSharedCount - recentTopShared.length} more recent
              </span>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {topShared.map((concept) => (
          <span
            key={concept.concept_id}
            className="inline-flex items-center rounded-md bg-[#1C1C20] border border-[#2A2A30] px-2 py-0.5 text-xs text-[#C5C0B8]"
            title={`Concept ID: ${concept.concept_id}`}
          >
            {concept.name}
          </span>
        ))}
        {sharedCount > topShared.length && (
          <span className="inline-flex items-center text-[10px] text-[#5A5650] px-1">
            +{sharedCount - topShared.length} more
          </span>
        )}
      </div>
    </div>
  );
}

export function SimilarPatientTable({
  patients,
  showPersonId,
  seedPersonId,
  sourceId,
}: SimilarPatientTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-[#8A857D]">No similar patients found for the given criteria.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#1C1C20] border-b border-[#2A2A30]">
              <th className="px-2 py-2.5 w-8" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px] w-12">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
                Score
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
                Patient
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
                Demographics
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
                Conditions
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
                Labs
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
                Drugs
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
                Procedures
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
                Genomics
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px] w-20">
                Compare
              </th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient, index) => {
              const overallScore = normalizeScore(patient.overall_score);
              const scoreColor = getOverallScoreColor(overallScore ?? 0);
              const isExpanded = expandedRows.has(index);
              const hasDetails = patient.shared_features != null || patient.similarity_summary != null;
              const compareUrl =
                seedPersonId && sourceId && patient.person_id
                  ? `/patient-similarity/compare?person_a=${seedPersonId}&person_b=${patient.person_id}&source_id=${sourceId}`
                  : null;
              const dimensionScores = patient.dimension_scores ?? {};

              const rowKey = patient.person_id ?? index;
              return (
                <Fragment key={rowKey}>
                  <tr
                    className={cn(
                      "border-b border-[#2A2A30]/50 transition-colors",
                      hasDetails ? "cursor-pointer hover:bg-[#1C1C20]/50" : "hover:bg-[#1C1C20]/30",
                      isExpanded && "bg-[#1C1C20]/30",
                    )}
                    onClick={() => hasDetails && toggleRow(index)}
                  >
                    <td className="px-2 py-2.5 text-[#5A5650]">
                      {hasDetails && (
                        isExpanded
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#5A5650] tabular-nums">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="font-['IBM_Plex_Mono',monospace] text-sm font-semibold tabular-nums"
                        style={{ color: scoreColor }}
                      >
                        {overallScore !== null ? overallScore.toFixed(3) : "N/A"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-xs text-[#C5C0B8]">
                        {formatPatientSummary(patient)}
                      </div>
                      {showPersonId && patient.person_id && (
                        <div className="text-[10px] text-[#5A5650] mt-0.5 tabular-nums">
                          ID: {patient.person_id}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <DimensionScoreBar
                        score={normalizeScore(dimensionScores.demographics)}
                        label="Demographics"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <DimensionScoreBar
                        score={normalizeScore(dimensionScores.conditions)}
                        label="Conditions"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <DimensionScoreBar
                        score={normalizeScore(dimensionScores.measurements)}
                        label="Labs"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <DimensionScoreBar
                        score={normalizeScore(dimensionScores.drugs)}
                        label="Drugs"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <DimensionScoreBar
                        score={normalizeScore(dimensionScores.procedures)}
                        label="Procedures"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <DimensionScoreBar
                        score={normalizeScore(dimensionScores.genomics)}
                        label="Genomics"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {compareUrl ? (
                        <Link
                          to={compareUrl}
                          className="text-xs text-[#2DD4BF] hover:text-[#2DD4BF]/80 font-medium transition-colors"
                        >
                          Compare
                        </Link>
                      ) : (
                        <span className="text-xs text-[#323238]">--</span>
                      )}
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {isExpanded && hasDetails && (
                    <tr className="border-b border-[#2A2A30]/50 bg-[#0E0E11]">
                      <td />
                      <td colSpan={10} className="px-4 py-3">
                        <div className="space-y-3">
                          {/* Similarity narrative */}
                          {patient.similarity_summary && (
                            <p className="text-xs text-[#C5C0B8] leading-relaxed">
                              {patient.similarity_summary}
                            </p>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <div className="rounded-md border border-[#2A2A30] bg-[#0E0E11] px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">
                                Anchor Date
                              </div>
                              <div className="mt-1 text-xs text-[#C5C0B8]">
                                {formatAnchorDate(patient.anchor_date)}
                              </div>
                            </div>
                            <div className="rounded-md border border-[#2A2A30] bg-[#0E0E11] px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">
                                Conditions
                              </div>
                              <div className="mt-1 text-xs text-[#C5C0B8]">
                                {patient.condition_count ?? "\u2014"}
                              </div>
                            </div>
                            <div className="rounded-md border border-[#2A2A30] bg-[#0E0E11] px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">
                                Labs
                              </div>
                              <div className="mt-1 text-xs text-[#C5C0B8]">
                                {patient.lab_count ?? "\u2014"}
                              </div>
                            </div>
                            <div className="rounded-md border border-[#2A2A30] bg-[#0E0E11] px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">
                                Vector Version
                              </div>
                              <div className="mt-1 text-xs text-[#C5C0B8]">
                                {patient.feature_vector_version ?? "\u2014"}
                              </div>
                            </div>
                          </div>

                          {/* Shared feature pills */}
                          {patient.shared_features && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <SharedFeaturePills
                                category={patient.shared_features.conditions}
                                icon={<Stethoscope size={11} className="text-[#9B1B30]" />}
                                label="Conditions"
                              />
                              <SharedFeaturePills
                                category={patient.shared_features.drugs}
                                icon={<Pill size={11} className="text-[#2DD4BF]" />}
                                label="Medications"
                              />
                              <SharedFeaturePills
                                category={patient.shared_features.procedures}
                                icon={<FlaskConical size={11} className="text-[#C9A227]" />}
                                label="Procedures"
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
