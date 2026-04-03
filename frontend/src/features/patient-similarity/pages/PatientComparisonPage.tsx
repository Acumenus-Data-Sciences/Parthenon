import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { DimensionScoreBar } from "../components/DimensionScoreBar";
import { useComparePatients } from "../hooks/usePatientSimilarity";
import type {
  PatientComparisonResult,
  DimensionScores,
} from "../types/patientSimilarity";

function getOverallScoreColor(score: number): string {
  if (score >= 0.8) return "#2DD4BF";
  if (score >= 0.5) return "#C9A227";
  return "#8A857D";
}

function formatGender(genderConceptId: number | null): string {
  if (genderConceptId === 8507) return "Male";
  if (genderConceptId === 8532) return "Female";
  return "Unknown";
}

function PatientColumn({
  label,
  patient,
}: {
  label: string;
  patient: PatientComparisonResult["person_a"];
}) {
  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-xs text-[#5A5650] uppercase tracking-wider mb-3">
        {label}
      </h3>

      {/* Demographics */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-3 mb-3">
        <h4 className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
          Demographics
        </h4>
        <div className="flex items-center gap-3 text-sm text-[#C5C0B8]">
          <span>{formatGender(patient.gender_concept_id)}</span>
          <span className="text-[#5A5650]">/</span>
          <span>
            {patient.age_bucket != null
              ? `${patient.age_bucket * 5}-${patient.age_bucket * 5 + 4}y`
              : "N/A"}
          </span>
        </div>
      </div>

      {/* Counts */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-3 mb-3">
        <h4 className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
          Feature Counts
        </h4>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8A857D]">Conditions</span>
            <span className="text-[#C5C0B8] font-medium tabular-nums">
              {patient.condition_count}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8A857D]">Labs</span>
            <span className="text-[#C5C0B8] font-medium tabular-nums">
              {patient.lab_count}
            </span>
          </div>
        </div>
      </div>

      {/* Dimensions Available */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-3">
        <h4 className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
          Dimensions Available
        </h4>
        {patient.dimensions_available.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {patient.dimensions_available.map((dim) => (
              <span
                key={dim}
                className="rounded bg-[#232328] px-1.5 py-0.5 text-[10px] text-[#C5C0B8]"
              >
                {dim}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[#5A5650]">None</span>
        )}
      </div>
    </div>
  );
}

function SharedSection({
  comparison,
}: {
  comparison: PatientComparisonResult;
}) {
  const { shared_features } = comparison;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="text-xs text-[#5A5650] uppercase tracking-wider mb-3">
        Shared Features
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8A857D]">Conditions</span>
            <span className="text-xs font-medium text-[#E85A6B] tabular-nums">
              {shared_features.condition_count}
            </span>
          </div>
          {shared_features.conditions.length > 0 ? (
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {shared_features.conditions.map((conceptId) => (
                <div
                  key={conceptId}
                  className="text-[11px] text-[#C5C0B8] truncate tabular-nums"
                >
                  Concept {conceptId}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[#5A5650]">None</span>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8A857D]">Drugs</span>
            <span className="text-xs font-medium text-[#C9A227] tabular-nums">
              {shared_features.drug_count}
            </span>
          </div>
          {shared_features.drugs.length > 0 ? (
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {shared_features.drugs.map((conceptId) => (
                <div
                  key={conceptId}
                  className="text-[11px] text-[#C5C0B8] truncate tabular-nums"
                >
                  Concept {conceptId}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[#5A5650]">None</span>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8A857D]">Procedures</span>
            <span className="text-xs font-medium text-[#2DD4BF] tabular-nums">
              {shared_features.procedure_count}
            </span>
          </div>
          {shared_features.procedures.length > 0 ? (
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {shared_features.procedures.map((conceptId) => (
                <div
                  key={conceptId}
                  className="text-[11px] text-[#C5C0B8] truncate tabular-nums"
                >
                  Concept {conceptId}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[#5A5650]">None</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DimensionScoresPanel({
  scores,
  overallScore,
}: {
  scores: DimensionScores;
  overallScore: number;
}) {
  const scoreColor = getOverallScoreColor(overallScore);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-[#5A5650] uppercase tracking-wider">
          Similarity Scores
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#5A5650]">Overall:</span>
          <span
            className="font-['IBM_Plex_Mono',monospace] text-lg font-bold tabular-nums"
            style={{ color: scoreColor }}
          >
            {overallScore.toFixed(3)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#C5C0B8]">Demographics</span>
          <DimensionScoreBar score={scores.demographics} label="Demographics" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#C5C0B8]">Conditions</span>
          <DimensionScoreBar score={scores.conditions} label="Conditions" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#C5C0B8]">Measurements</span>
          <DimensionScoreBar
            score={scores.measurements}
            label="Measurements"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#C5C0B8]">Drugs</span>
          <DimensionScoreBar score={scores.drugs} label="Drugs" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#C5C0B8]">Procedures</span>
          <DimensionScoreBar score={scores.procedures} label="Procedures" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#C5C0B8]">Genomics</span>
          <DimensionScoreBar score={scores.genomics} label="Genomics" />
        </div>
      </div>
    </div>
  );
}

export default function PatientComparisonPage() {
  const [searchParams] = useSearchParams();

  const personA = parseInt(searchParams.get("person_a") ?? "0", 10);
  const personB = parseInt(searchParams.get("person_b") ?? "0", 10);
  const sourceId = parseInt(searchParams.get("source_id") ?? "0", 10);

  const {
    data: comparison,
    isLoading,
    isError,
  } = useComparePatients(personA, personB, sourceId);

  // Build back-link to search results
  const backUrl = sourceId
    ? `/patient-similarity?source_id=${sourceId}&person_id=${personA}`
    : "/patient-similarity";

  if (personA <= 0 || personB <= 0 || sourceId <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle size={36} className="text-[#E85A6B] mb-4" />
        <h2 className="text-lg font-semibold text-[#F0EDE8]">
          Missing Parameters
        </h2>
        <p className="mt-2 text-sm text-[#8A857D]">
          person_a, person_b, and source_id are required.
        </p>
        <Link
          to="/patient-similarity"
          className="mt-4 text-sm text-[#2DD4BF] hover:underline"
        >
          Back to Patient Similarity
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={backUrl}
          className="flex items-center gap-1.5 text-xs text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to results
        </Link>
        <h1 className="page-title">Patient Comparison</h1>
        <span className="text-xs text-[#5A5650] tabular-nums">
          #{personA} vs #{personB}
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
          <span className="ml-3 text-sm text-[#8A857D]">
            Comparing patients...
          </span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
          <p className="text-sm text-[#E85A6B]">
            Comparison failed. Please verify both patients exist in this data
            source.
          </p>
        </div>
      )}

      {/* Comparison content */}
      {comparison && (
        <>
          {/* Dimension Scores */}
          <DimensionScoresPanel
            scores={comparison.scores.dimension_scores}
            overallScore={comparison.scores.overall_score}
          />

          {/* Shared Features */}
          <SharedSection comparison={comparison} />

          {/* Side-by-side patient features */}
          <div className="flex gap-6">
            <PatientColumn
              label={`Patient A (#${comparison.person_a.person_id})`}
              patient={comparison.person_a}
            />
            <div className="w-px bg-[#232328] shrink-0" />
            <PatientColumn
              label={`Patient B (#${comparison.person_b.person_id})`}
              patient={comparison.person_b}
            />
          </div>
        </>
      )}
    </div>
  );
}
