import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { DimensionScoreBar } from "../components/DimensionScoreBar";
import { useComparePatients } from "../hooks/usePatientSimilarity";
import type {
  PatientFeatureSet,
  PatientComparisonResult,
  DimensionScores,
} from "../types/patientSimilarity";

function getOverallScoreColor(score: number): string {
  if (score >= 0.8) return "#2DD4BF";
  if (score >= 0.5) return "#C9A227";
  return "#8A857D";
}

function PatientColumn({
  label,
  patient,
}: {
  label: string;
  patient: PatientFeatureSet;
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
        {patient.demographics ? (
          <div className="flex items-center gap-3 text-sm text-[#C5C0B8]">
            <span>{patient.demographics.gender}</span>
            <span className="text-[#5A5650]">/</span>
            <span>{patient.demographics.age}y</span>
          </div>
        ) : (
          <span className="text-xs text-[#5A5650]">N/A</span>
        )}
      </div>

      {/* Conditions */}
      <FeatureList
        title="Conditions"
        items={patient.conditions}
        color="#E85A6B"
      />

      {/* Drugs */}
      <FeatureList title="Drugs" items={patient.drugs} color="#C9A227" />

      {/* Procedures */}
      <FeatureList
        title="Procedures"
        items={patient.procedures}
        color="#2DD4BF"
      />

      {/* Measurements */}
      <FeatureList
        title="Measurements"
        items={patient.measurements}
        color="#8B5CF6"
      />
    </div>
  );
}

function FeatureList({
  title,
  items,
  color,
}: {
  title: string;
  items: Array<{ concept_id: number; concept_name: string }>;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] text-[#5A5650] uppercase tracking-wider">
          {title}
        </h4>
        <span className="text-[10px] font-medium tabular-nums" style={{ color }}>
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.concept_id}
              className="text-xs text-[#C5C0B8] truncate"
              title={item.concept_name}
            >
              {item.concept_name}
            </div>
          ))}
        </div>
      ) : (
        <span className="text-xs text-[#5A5650]">None</span>
      )}
    </div>
  );
}

function SharedSection({
  comparison,
}: {
  comparison: PatientComparisonResult;
}) {
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
              {comparison.shared_conditions.length}
            </span>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {comparison.shared_conditions.map((c) => (
              <div
                key={c.concept_id}
                className="text-[11px] text-[#C5C0B8] truncate"
              >
                {c.concept_name}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8A857D]">Drugs</span>
            <span className="text-xs font-medium text-[#C9A227] tabular-nums">
              {comparison.shared_drugs.length}
            </span>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {comparison.shared_drugs.map((d) => (
              <div
                key={d.concept_id}
                className="text-[11px] text-[#C5C0B8] truncate"
              >
                {d.concept_name}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8A857D]">Procedures</span>
            <span className="text-xs font-medium text-[#2DD4BF] tabular-nums">
              {comparison.shared_procedures.length}
            </span>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {comparison.shared_procedures.map((p) => (
              <div
                key={p.concept_id}
                className="text-[11px] text-[#C5C0B8] truncate"
              >
                {p.concept_name}
              </div>
            ))}
          </div>
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
            scores={comparison.dimension_scores}
            overallScore={comparison.overall_score}
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
