import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import {
  getSimilarityGenderLabel,
  getSimilarityScoreLabel,
} from "../lib/i18n";
import { DimensionScoreBar } from "../components/DimensionScoreBar";
import { useComparePatients } from "../hooks/usePatientSimilarity";
import type {
  PatientComparisonResult,
  DimensionScores,
  ResolvedConcept,
} from "../types/patientSimilarity";

// ── Helpers ──────────────────────────────────────────────────────────

function getOverallScoreColor(score: number): string {
  if (score >= 0.8) return "var(--color-primary)";
  if (score >= 0.5) return "var(--color-primary)";
  return "var(--color-text-secondary)";
}

// ── Score Summary Banner ─────────────────────────────────────────────

function ScoreBanner({
  comparison,
}: {
  comparison: PatientComparisonResult;
}) {
  const { t } = useTranslation("app");
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
      t("patientSimilarity.comparison.narrative.sameDemographicProfile", {
        gender: getSimilarityGenderLabel(t, pA.gender_concept_id).toLowerCase(),
        age:
          ageDiff === 0
            ? t("patientSimilarity.comparison.narrative.sameAgeRange")
            : t("patientSimilarity.comparison.narrative.ageGap", {
                count: ageDiff,
              }),
      }),
    );
  }

  const condScore = dimension_scores.conditions;
  if (condScore !== null && condScore >= 0.7) {
    const ct = comparison.shared_features.condition_count;
    parts.push(
      t("patientSimilarity.comparison.narrative.sharedDiagnoses", {
        count: ct,
      }),
    );
  }

  const drugScore = dimension_scores.drugs;
  if (drugScore !== null && drugScore >= 0.5) {
    const ct = comparison.shared_features.drug_count;
    parts.push(
      t("patientSimilarity.comparison.narrative.sharedMedications", {
        count: ct,
      }),
    );
  }

  const procCount = comparison.shared_features.procedure_count;
  if (procCount > 0) {
    parts.push(
      t("patientSimilarity.comparison.narrative.sharedProcedures", {
        count: procCount,
      }),
    );
  }

  const measScore = dimension_scores.measurements;
  if (measScore !== null && measScore >= 0.5) {
    const label =
      measScore >= 0.8
        ? t("patientSimilarity.comparison.narrative.labProfilesVerySimilar")
        : measScore >= 0.6
          ? t("patientSimilarity.comparison.narrative.labProfilesSimilar")
          : t(
              "patientSimilarity.comparison.narrative.labProfilesModeratelySimilar",
            );
    parts.push(label);
  }

  const narrative =
    parts.length > 0
      ? t("patientSimilarity.comparison.narrative.sharedSummary", {
          items: parts.join(", "),
        })
      : t("patientSimilarity.comparison.narrative.limitedOverlap");

  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-5">
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
              {t("patientSimilarity.comparison.overallSimilarity", {
                label: getSimilarityScoreLabel(t, overall_score),
              })}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{narrative}</p>
        </div>
      </div>
    </div>
  );
}

function DimensionScoresGrid({ scores }: { scores: DimensionScores }) {
  const { t } = useTranslation("app");
  const dimensions = [
    {
      key: "demographics" as const,
      label: t("patientSimilarity.common.dimensions.demographics"),
      icon: <User size={14} />,
      color: "var(--color-text-secondary)",
    },
    {
      key: "conditions" as const,
      label: t("patientSimilarity.common.dimensions.conditions"),
      icon: <Stethoscope size={14} />,
      color: "var(--color-critical)",
    },
    {
      key: "measurements" as const,
      label: t("patientSimilarity.comparison.demographics.labTypes"),
      icon: <Activity size={14} />,
      color: "var(--color-primary)",
    },
    {
      key: "drugs" as const,
      label: t("patientSimilarity.common.dimensions.medications"),
      icon: <Pill size={14} />,
      color: "var(--color-primary)",
    },
    {
      key: "procedures" as const,
      label: t("patientSimilarity.common.dimensions.procedures"),
      icon: <FlaskConical size={14} />,
      color: "var(--color-domain-procedure)",
    },
    {
      key: "genomics" as const,
      label: t("patientSimilarity.common.dimensions.genomics"),
      icon: <Dna size={14} />,
      color: "var(--color-critical)",
    },
  ];

  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <h3 className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">
        {t("patientSimilarity.comparison.sectionTitles.dimensionBreakdown")}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {dimensions.map(({ key, label, icon, color }) => {
          const score = scores[key];
          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border p-3 space-y-1.5",
                score === null
                  ? "border-[var(--color-surface-raised)] bg-[var(--color-surface-base)]/50 opacity-50"
                  : "border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)]",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span style={{ color }}>{icon}</span>
                <span className="text-xs text-[var(--color-text-primary)] font-medium">
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
  const { t } = useTranslation("app");
  const pA = comparison.person_a;
  const pB = comparison.person_b;

  const rows = [
    {
      label: t("patientSimilarity.comparison.demographics.gender"),
      a: getSimilarityGenderLabel(t, pA.gender_concept_id),
      b: getSimilarityGenderLabel(t, pB.gender_concept_id),
      match: pA.gender_concept_id === pB.gender_concept_id,
    },
    {
      label: t("patientSimilarity.comparison.demographics.ageRange"),
      a:
        pA.age_bucket != null
          ? `${pA.age_bucket * 5}–${pA.age_bucket * 5 + 4}`
          : t("profiles.common.notAvailable"),
      b:
        pB.age_bucket != null
          ? `${pB.age_bucket * 5}–${pB.age_bucket * 5 + 4}`
          : t("profiles.common.notAvailable"),
      match: pA.age_bucket === pB.age_bucket,
    },
    {
      label: t("patientSimilarity.common.dimensions.conditions"),
      a: String(pA.condition_count),
      b: String(pB.condition_count),
      match: false,
    },
    {
      label: t("patientSimilarity.comparison.demographics.labTypes"),
      a: String(pA.lab_count),
      b: String(pB.lab_count),
      match: false,
    },
  ];

  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <h3 className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">
        {t("patientSimilarity.comparison.sectionTitles.patientDemographics")}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-surface-overlay)]">
            <th className="py-1.5 text-left text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold w-28" />
            <th className="py-1.5 text-center text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
              {t("patientSimilarity.common.patientA")} (#{pA.person_id})
            </th>
            <th className="py-1.5 w-10" />
            <th className="py-1.5 text-center text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
              {t("patientSimilarity.common.patientB")} (#{pB.person_id})
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[var(--color-surface-raised)]">
              <td className="py-2 text-xs text-[var(--color-text-secondary)]">{row.label}</td>
              <td className="py-2 text-center text-xs text-[var(--color-text-primary)] font-medium tabular-nums">
                {row.a}
              </td>
              <td className="py-2 text-center">
                {row.match ? (
                  <CheckCircle2 size={12} className="text-[var(--color-primary)] mx-auto" />
                ) : (
                  <XCircle size={12} className="text-[var(--color-text-muted)] mx-auto" />
                )}
              </td>
              <td className="py-2 text-center text-xs text-[var(--color-text-primary)] font-medium tabular-nums">
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
  const { t } = useTranslation("app");
  if (totalShared === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-surface-raised)] bg-[var(--color-surface-base)]/50 p-4 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: accentColor }}>{icon}</span>
          <h4 className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
            {title}
          </h4>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t("patientSimilarity.comparison.sharedFeatures.noShared", {
            label: title.toLowerCase(),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: accentColor }}>{icon}</span>
          <h4 className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
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
          {t("patientSimilarity.comparison.sharedFeatures.totalShared", {
            count: totalShared,
          })}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((concept) => (
          <span
            key={concept.concept_id}
            className="inline-flex items-center rounded-md border px-2 py-1 text-xs text-[var(--color-text-primary)]"
            style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }}
            title={`Concept ID: ${concept.concept_id}`}
          >
            {concept.name}
          </span>
        ))}
        {totalShared > items.length && (
          <span className="inline-flex items-center text-[10px] text-[var(--color-text-muted)] px-2 py-1">
            {t("patientSimilarity.comparison.sharedFeatures.more", {
              count: totalShared - items.length,
            })}
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
  const { t } = useTranslation("app");
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
      translatedLabel: t("patientSimilarity.common.dimensions.conditions"),
      shared: sharedCond,
      uniqueA: uniqueACond,
      uniqueB: uniqueBCond,
      color: "var(--color-critical)",
    },
    {
      translatedLabel: t("patientSimilarity.common.dimensions.medications"),
      shared: shared_features.drug_count,
      uniqueA: null,
      uniqueB: null,
      color: "var(--color-primary)",
    },
    {
      translatedLabel: t("patientSimilarity.common.dimensions.procedures"),
      shared: shared_features.procedure_count,
      uniqueA: null,
      uniqueB: null,
      color: "var(--color-domain-procedure)",
    },
  ];

  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <h3 className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">
        {t("patientSimilarity.comparison.sectionTitles.featureOverlap")}
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
            <div key={row.translatedLabel} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {row.translatedLabel}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: row.color }}
                  >
                    {t("patientSimilarity.comparison.sharedFeatures.totalShared", {
                      count: row.shared,
                    })}
                  </span>
                  {pct !== null && (
                    <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                      {t("patientSimilarity.comparison.overlap.overlapPercent", {
                        count: pct,
                      })}
                    </span>
                  )}
                </div>
              </div>
              {total != null && total > 0 && (
                <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--color-surface-raised)]">
                  {row.uniqueA != null && row.uniqueA > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(row.uniqueA / total) * 100}%`,
                        backgroundColor: "var(--color-text-muted)",
                      }}
                      title={t("patientSimilarity.comparison.overlap.patientAOnly", {
                        count: row.uniqueA,
                      })}
                    />
                  )}
                  <div
                    className="h-full"
                    style={{
                      width: `${(row.shared / total) * 100}%`,
                      backgroundColor: row.color,
                    }}
                    title={t("patientSimilarity.comparison.sharedFeatures.totalShared", {
                      count: row.shared,
                    })}
                  />
                  {row.uniqueB != null && row.uniqueB > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(row.uniqueB / total) * 100}%`,
                        backgroundColor: "var(--color-surface-accent)",
                      }}
                      title={t("patientSimilarity.comparison.overlap.patientBOnly", {
                        count: row.uniqueB,
                      })}
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
  const { t } = useTranslation("app");
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
        <AlertCircle size={36} className="text-[var(--color-critical)] mb-4" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("patientSimilarity.comparison.missingParameters")}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {t("patientSimilarity.comparison.missingParametersDetail")}
        </p>
        <Link
          to="/patient-similarity"
          className="mt-4 text-sm text-[var(--color-primary)] hover:underline"
        >
          {t("patientSimilarity.comparison.backToPatientSimilarity")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          to={backUrl}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          {t("patientSimilarity.common.backToWorkspace")}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="page-title">
            {t("patientSimilarity.comparison.pageTitle")}
          </h1>
          <span className="text-sm text-[var(--color-text-secondary)] tabular-nums font-['IBM_Plex_Mono',monospace]">
            #{personA} {t("patientSimilarity.headToHead.vs")} #{personB}
          </span>
        </div>
        <p className="page-subtitle">
          {t("patientSimilarity.comparison.subtitle")}
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
          <span className="ml-3 text-sm text-[var(--color-text-secondary)]">
            {t("patientSimilarity.comparison.comparingPatients")}
          </span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-[var(--color-critical)]/20 bg-[var(--color-critical)]/5 px-4 py-3">
          <p className="text-sm text-[var(--color-critical)]">
            {t("patientSimilarity.comparison.comparisonFailed")}
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
            <h3 className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
              {t("patientSimilarity.comparison.sectionTitles.sharedClinicalFeatures")}
            </h3>
            <SharedFeatureSection
              title={t("patientSimilarity.common.dimensions.conditions")}
              icon={<Stethoscope size={14} />}
              accentColor="var(--color-critical)"
              items={comparison.shared_features.condition_names ?? []}
              totalShared={comparison.shared_features.condition_count}
            />
            <SharedFeatureSection
              title={t("patientSimilarity.common.dimensions.medications")}
              icon={<Pill size={14} />}
              accentColor="var(--color-primary)"
              items={comparison.shared_features.drug_names ?? []}
              totalShared={comparison.shared_features.drug_count}
            />
            <SharedFeatureSection
              title={t("patientSimilarity.common.dimensions.procedures")}
              icon={<FlaskConical size={14} />}
              accentColor="var(--color-domain-procedure)"
              items={comparison.shared_features.procedure_names ?? []}
              totalShared={comparison.shared_features.procedure_count}
            />
          </div>
        </>
      )}
    </div>
  );
}
