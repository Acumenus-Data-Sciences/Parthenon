import { useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Stethoscope,
  Pill,
  FlaskConical,
  Dna,
  User,
  Activity,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DimensionScoreBar } from "../components/DimensionScoreBar";
import { useComparePatients } from "../hooks/usePatientSimilarity";
import type {
  PatientComparisonResult,
  DimensionScores,
  ResolvedConcept,
} from "../types/patientSimilarity";

// ── Helpers ──────────────────────────────────────────────────────────

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

function scoreLabel(score: number): string {
  if (score >= 0.9) return "Very High";
  if (score >= 0.7) return "High";
  if (score >= 0.5) return "Moderate";
  if (score >= 0.3) return "Low";
  return "Very Low";
}

// ── Score Summary Banner ─────────────────────────────────────────────

function ScoreBanner({
  comparison,
}: {
  comparison: PatientComparisonResult;
}) {
  const { overall_score, dimension_scores } = comparison.scores;
  const color = getOverallScoreColor(overall_score);
  const pA = comparison.person_a;
  const pB = comparison.person_b;

  const sameGender = pA.gender_concept_id === pB.gender_concept_id;
  const ageDiff =
    pA.age_bucket != null && pB.age_bucket != null
      ? Math.abs(pA.age_bucket - pB.age_bucket) * 5
      : null;

  // Build a short narrative
  const parts: string[] = [];
  if (sameGender && ageDiff !== null && ageDiff <= 5) {
    parts.push(
      `same demographic profile (${formatGender(pA.gender_concept_id).toLowerCase()}, ${ageDiff === 0 ? "same age range" : `${ageDiff}-year age gap`})`,
    );
  }

  const condScore = dimension_scores.conditions;
  if (condScore !== null && condScore >= 0.7) {
    const ct = comparison.shared_features.condition_count;
    parts.push(`${ct} shared diagnoses`);
  }

  const drugScore = dimension_scores.drugs;
  if (drugScore !== null && drugScore >= 0.5) {
    const ct = comparison.shared_features.drug_count;
    parts.push(`${ct} shared medications`);
  }

  const procCount = comparison.shared_features.procedure_count;
  if (procCount > 0) {
    parts.push(`${procCount} shared procedures`);
  }

  const measScore = dimension_scores.measurements;
  if (measScore !== null && measScore >= 0.5) {
    const label =
      measScore >= 0.8
        ? "very similar"
        : measScore >= 0.6
          ? "similar"
          : "moderately similar";
    parts.push(`${label} lab profiles`);
  }

  const narrative =
    parts.length > 0
      ? `These patients share ${parts.join(", ")}.`
      : "Limited overlap found between these patients.";

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1 min-w-0 mr-6">
          <div className="flex items-center gap-3">
            <span
              className="font-['IBM_Plex_Mono',monospace] text-2xl font-bold tabular-nums"
              style={{ color }}
            >
              {overall_score.toFixed(3)}
            </span>
            <span className="text-sm font-medium" style={{ color }}>
              {scoreLabel(overall_score)} Similarity
            </span>
          </div>
          <p className="text-sm text-[#C5C0B8] leading-relaxed">{narrative}</p>
        </div>
      </div>
    </div>
  );
}

// ── Dimension Scores Grid ────────────────────────────────────────────

interface DimensionInfo {
  key: keyof DimensionScores;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const DIMENSIONS: DimensionInfo[] = [
  {
    key: "demographics",
    label: "Demographics",
    icon: <User size={14} />,
    color: "#8A857D",
  },
  {
    key: "conditions",
    label: "Conditions",
    icon: <Stethoscope size={14} />,
    color: "#9B1B30",
  },
  {
    key: "measurements",
    label: "Lab Values",
    icon: <Activity size={14} />,
    color: "#C9A227",
  },
  {
    key: "drugs",
    label: "Medications",
    icon: <Pill size={14} />,
    color: "#2DD4BF",
  },
  {
    key: "procedures",
    label: "Procedures",
    icon: <FlaskConical size={14} />,
    color: "#7C6CDB",
  },
  {
    key: "genomics",
    label: "Genomics",
    icon: <Dna size={14} />,
    color: "#E85A6B",
  },
];

function DimensionScoresGrid({ scores }: { scores: DimensionScores }) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="text-[10px] text-[#5A5650] uppercase tracking-wider font-semibold mb-3">
        Dimension Breakdown
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DIMENSIONS.map(({ key, label, icon, color }) => {
          const score = scores[key];
          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border p-3 space-y-1.5",
                score === null
                  ? "border-[#1C1C20] bg-[#0E0E11]/50 opacity-50"
                  : "border-[#232328] bg-[#0E0E11]",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span style={{ color }}>{icon}</span>
                <span className="text-xs text-[#C5C0B8] font-medium">
                  {label}
                </span>
              </div>
              <DimensionScoreBar score={score} label={label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Demographics Comparison ──────────────────────────────────────────

function DemographicsComparison({
  comparison,
}: {
  comparison: PatientComparisonResult;
}) {
  const pA = comparison.person_a;
  const pB = comparison.person_b;

  const rows = [
    {
      label: "Gender",
      a: formatGender(pA.gender_concept_id),
      b: formatGender(pB.gender_concept_id),
      match: pA.gender_concept_id === pB.gender_concept_id,
    },
    {
      label: "Age Range",
      a:
        pA.age_bucket != null
          ? `${pA.age_bucket * 5}–${pA.age_bucket * 5 + 4}`
          : "N/A",
      b:
        pB.age_bucket != null
          ? `${pB.age_bucket * 5}–${pB.age_bucket * 5 + 4}`
          : "N/A",
      match: pA.age_bucket === pB.age_bucket,
    },
    {
      label: "Conditions",
      a: String(pA.condition_count),
      b: String(pB.condition_count),
      match: false,
    },
    {
      label: "Lab Types",
      a: String(pA.lab_count),
      b: String(pB.lab_count),
      match: false,
    },
  ];

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="text-[10px] text-[#5A5650] uppercase tracking-wider font-semibold mb-3">
        Patient Demographics
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#232328]">
            <th className="py-1.5 text-left text-[10px] text-[#5A5650] uppercase tracking-wider font-semibold w-28" />
            <th className="py-1.5 text-center text-[10px] text-[#5A5650] uppercase tracking-wider font-semibold">
              Patient A (#{pA.person_id})
            </th>
            <th className="py-1.5 w-10" />
            <th className="py-1.5 text-center text-[10px] text-[#5A5650] uppercase tracking-wider font-semibold">
              Patient B (#{pB.person_id})
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[#1C1C20]">
              <td className="py-2 text-xs text-[#8A857D]">{row.label}</td>
              <td className="py-2 text-center text-xs text-[#C5C0B8] font-medium tabular-nums">
                {row.a}
              </td>
              <td className="py-2 text-center">
                {row.match ? (
                  <CheckCircle2 size={12} className="text-[#2DD4BF] mx-auto" />
                ) : (
                  <XCircle size={12} className="text-[#5A5650] mx-auto" />
                )}
              </td>
              <td className="py-2 text-center text-xs text-[#C5C0B8] font-medium tabular-nums">
                {row.b}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Shared Feature Section ───────────────────────────────────────────

function SharedFeatureSection({
  title,
  icon,
  accentColor,
  items,
  totalShared,
}: {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  items: ResolvedConcept[];
  totalShared: number;
}) {
  if (totalShared === 0) {
    return (
      <div className="rounded-lg border border-[#1C1C20] bg-[#0E0E11]/50 p-4 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: accentColor }}>{icon}</span>
          <h4 className="text-xs text-[#5A5650] font-semibold uppercase tracking-wider">
            {title}
          </h4>
        </div>
        <p className="text-xs text-[#5A5650]">No shared {title.toLowerCase()}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: accentColor }}>{icon}</span>
          <h4 className="text-xs text-[#5A5650] font-semibold uppercase tracking-wider">
            {title}
          </h4>
        </div>
        <span
          className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded"
          style={{
            color: accentColor,
            backgroundColor: `${accentColor}15`,
          }}
        >
          {totalShared} shared
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((concept) => (
          <span
            key={concept.concept_id}
            className="inline-flex items-center rounded-md border px-2 py-1 text-xs text-[#C5C0B8]"
            style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }}
            title={`Concept ID: ${concept.concept_id}`}
          >
            {concept.name}
          </span>
        ))}
        {totalShared > items.length && (
          <span className="inline-flex items-center text-[10px] text-[#5A5650] px-2 py-1">
            +{totalShared - items.length} more
          </span>
        )}
      </div>
    </div>
  );
}

// ── Unique Features Section ──────────────────────────────────────────

function UniqueFeaturesSummary({
  comparison,
}: {
  comparison: PatientComparisonResult;
}) {
  const { shared_features } = comparison;
  const pA = comparison.person_a;
  const pB = comparison.person_b;

  // Calculate unique counts from dimensions_available
  const aCondCount = pA.condition_count;
  const bCondCount = pB.condition_count;
  const sharedCond = shared_features.condition_count;
  const uniqueACond = Math.max(0, aCondCount - sharedCond);
  const uniqueBCond = Math.max(0, bCondCount - sharedCond);

  const rows = [
    {
      label: "Conditions",
      shared: sharedCond,
      uniqueA: uniqueACond,
      uniqueB: uniqueBCond,
      color: "#9B1B30",
    },
    {
      label: "Medications",
      shared: shared_features.drug_count,
      uniqueA: null,
      uniqueB: null,
      color: "#2DD4BF",
    },
    {
      label: "Procedures",
      shared: shared_features.procedure_count,
      uniqueA: null,
      uniqueB: null,
      color: "#7C6CDB",
    },
  ];

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="text-[10px] text-[#5A5650] uppercase tracking-wider font-semibold mb-3">
        Feature Overlap
      </h3>
      <div className="space-y-2">
        {rows.map((row) => {
          const total =
            row.uniqueA !== null && row.uniqueB !== null
              ? row.shared + row.uniqueA + row.uniqueB
              : null;
          const pct =
            total != null && total > 0
              ? Math.round((row.shared / total) * 100)
              : null;

          return (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8A857D]">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: row.color }}
                  >
                    {row.shared} shared
                  </span>
                  {pct !== null && (
                    <span className="text-[10px] text-[#5A5650] tabular-nums">
                      ({pct}% overlap)
                    </span>
                  )}
                </div>
              </div>
              {total != null && total > 0 && (
                <div className="flex h-1.5 rounded-full overflow-hidden bg-[#1C1C20]">
                  {row.uniqueA != null && row.uniqueA > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(row.uniqueA / total) * 100}%`,
                        backgroundColor: "#5A5650",
                      }}
                      title={`Patient A only: ${row.uniqueA}`}
                    />
                  )}
                  <div
                    className="h-full"
                    style={{
                      width: `${(row.shared / total) * 100}%`,
                      backgroundColor: row.color,
                    }}
                    title={`Shared: ${row.shared}`}
                  />
                  {row.uniqueB != null && row.uniqueB > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(row.uniqueB / total) * 100}%`,
                        backgroundColor: "#3A3A40",
                      }}
                      title={`Patient B only: ${row.uniqueB}`}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

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
    <div className="space-y-4 max-w-5xl">
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
          {/* Score banner with narrative */}
          <ScoreBanner comparison={comparison} />

          {/* Two-column: Demographics + Overlap | Dimension Scores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DemographicsComparison comparison={comparison} />
            <div className="space-y-4">
              <DimensionScoresGrid scores={comparison.scores.dimension_scores} />
              <UniqueFeaturesSummary comparison={comparison} />
            </div>
          </div>

          {/* Shared features — named concepts */}
          <div className="space-y-3">
            <h3 className="text-[10px] text-[#5A5650] uppercase tracking-wider font-semibold">
              Shared Clinical Features
            </h3>
            <SharedFeatureSection
              title="Conditions"
              icon={<Stethoscope size={14} />}
              accentColor="#9B1B30"
              items={comparison.shared_features.condition_names ?? []}
              totalShared={comparison.shared_features.condition_count}
            />
            <SharedFeatureSection
              title="Medications"
              icon={<Pill size={14} />}
              accentColor="#2DD4BF"
              items={comparison.shared_features.drug_names ?? []}
              totalShared={comparison.shared_features.drug_count}
            />
            <SharedFeatureSection
              title="Procedures"
              icon={<FlaskConical size={14} />}
              accentColor="#7C6CDB"
              items={comparison.shared_features.procedure_names ?? []}
              totalShared={comparison.shared_features.procedure_count}
            />
          </div>
        </>
      )}
    </div>
  );
}
