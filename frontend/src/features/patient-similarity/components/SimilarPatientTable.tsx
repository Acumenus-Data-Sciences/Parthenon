import { Link } from "react-router-dom";
import { DimensionScoreBar } from "./DimensionScoreBar";
import type { SimilarPatient } from "../types/patientSimilarity";

interface SimilarPatientTableProps {
  patients: SimilarPatient[];
  showPersonId: boolean;
  seedPersonId?: number;
  sourceId?: number;
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

export function SimilarPatientTable({
  patients,
  showPersonId,
  seedPersonId,
  sourceId,
}: SimilarPatientTableProps) {
  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <p className="text-sm text-[#8A857D]">No similar patients found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#151518] border-b border-[#232328]">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider w-12">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider">
                Score
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider">
                Patient
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider">
                Demographics
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider">
                Conditions
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider">
                Labs
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider">
                Drugs
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider">
                Procedures
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider">
                Genomics
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider w-20">
                Compare
              </th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient, index) => {
              const scoreColor = getOverallScoreColor(patient.overall_score);
              const compareUrl =
                seedPersonId && sourceId && patient.person_id
                  ? `/patient-similarity/compare?person_a=${seedPersonId}&person_b=${patient.person_id}&source_id=${sourceId}`
                  : null;

              return (
                <tr
                  key={patient.person_id ?? index}
                  className="border-b border-[#1C1C20] hover:bg-[#1C1C20]/50 transition-colors"
                >
                  <td className="px-3 py-2.5 text-xs text-[#5A5650] tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="font-['IBM_Plex_Mono',monospace] text-sm font-semibold tabular-nums"
                      style={{ color: scoreColor }}
                    >
                      {patient.overall_score.toFixed(3)}
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
                      score={patient.dimension_scores.demographics}
                      label="Demographics"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <DimensionScoreBar
                      score={patient.dimension_scores.conditions}
                      label="Conditions"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <DimensionScoreBar
                      score={patient.dimension_scores.measurements}
                      label="Labs"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <DimensionScoreBar
                      score={patient.dimension_scores.drugs}
                      label="Drugs"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <DimensionScoreBar
                      score={patient.dimension_scores.procedures}
                      label="Procedures"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <DimensionScoreBar
                      score={patient.dimension_scores.genomics}
                      label="Genomics"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right">
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
