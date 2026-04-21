import { Loader2, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Drawer } from "@/components/ui/Drawer";
import { getSimilarityDimensionLabel, getSimilarityGenderLabel } from "../lib/i18n";
import { DimensionScoreBar } from "./DimensionScoreBar";
import { TrajectoryComparison } from "./TrajectoryComparison";
import { useComparePatients } from "../hooks/usePatientSimilarity";
import type { PatientComparisonResult, DimensionScores } from "../types/patientSimilarity";

export interface HeadToHeadDrawerProps {
  open: boolean;
  onClose: () => void;
  personAId: number | null;
  personBId: number | null;
  sourceId: number;
}

function ageBucketLabel(bucket: number | null | undefined): string {
  if (bucket == null) return "Unknown";
  return `Age ~${bucket}`;
}

function scoreGradient(score: number): string {
  if (score >= 0.7) return "from-success/60 to-success/20";
  if (score >= 0.4) return "from-accent/60 to-accent/20";
  return "from-text-muted/60 to-text-muted/20";
}

function scoreColor(score: number): string {
  if (score >= 0.7) return "var(--success)";
  if (score >= 0.4) return "var(--accent)";
  return "var(--text-muted)";
}

interface PatientCardProps {
  label: string;
  personId: number;
  ageBucket: number | null | undefined;
  genderConceptId: number | null | undefined;
  conditionCount: number;
  labCount: number;
  dimensionsAvailable: string[];
  sourceId: number;
  accentColor: string;
}

function PatientCard({
  label,
  personId,
  ageBucket,
  genderConceptId,
  conditionCount,
  labCount,
  dimensionsAvailable,
  sourceId,
  accentColor,
}: PatientCardProps) {
  const { t } = useTranslation("app");
  return (
    <div
      className="flex-1 rounded-lg border bg-surface-raised p-4 space-y-2"
      style={{ borderColor: accentColor + "40" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          {label}
        </span>
        <a
          href={`/patient-profiles/${personId}?source_id=${sourceId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] hover:underline"
          style={{ color: accentColor }}
        >
          {t("patientSimilarity.headToHead.profile", { defaultValue: "Profile" })} <ExternalLink size={10} />
        </a>
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: accentColor }}>
        #{personId}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-text-ghost">{t("patientSimilarity.comparison.demographics.gender")}</span>
          <span className="text-text-secondary">{getSimilarityGenderLabel(t, genderConceptId)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-text-ghost">{t("patientSimilarity.comparison.demographics.ageRange")}</span>
          <span className="text-text-secondary">{ageBucketLabel(ageBucket)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-text-ghost">{t("patientSimilarity.common.dimensions.conditions")}</span>
          <span className="text-text-secondary">{conditionCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-text-ghost">{t("patientSimilarity.common.dimensions.labs")}</span>
          <span className="text-text-secondary">{labCount}</span>
        </div>
      </div>
      {dimensionsAvailable.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {dimensionsAvailable.map((dim) => (
            <span
              key={dim}
              className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide"
              style={{ backgroundColor: accentColor + "20", color: accentColor }}
            >
              {dim}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface ComparisonContentProps {
  result: PatientComparisonResult;
  personAId: number;
  personBId: number;
  sourceId: number;
}

function ComparisonContent({ result, personAId, personBId, sourceId }: ComparisonContentProps) {
  const { t } = useTranslation("app");
  const { overall_score, dimension_scores } = result.scores;
  const dimensionKeys = [
    "demographics",
    "conditions",
    "measurements",
    "drugs",
    "procedures",
    "genomics",
  ] as (keyof DimensionScores)[];

  return (
    <div className="space-y-6">
      {/* Patient cards with VS badge */}
      <div className="flex items-center gap-3">
        <PatientCard
          label={t("patientSimilarity.common.patientA")}
          personId={result.person_a.person_id}
          ageBucket={result.person_a.age_bucket}
          genderConceptId={result.person_a.gender_concept_id}
          conditionCount={result.person_a.condition_count}
          labCount={result.person_a.lab_count}
          dimensionsAvailable={result.person_a.dimensions_available}
          sourceId={sourceId}
          accentColor="var(--success)"
        />

        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border-default bg-surface-base">
          <span className="text-[10px] font-bold text-text-ghost">
            {t("patientSimilarity.headToHead.vs", { defaultValue: "VS" })}
          </span>
        </div>

        <PatientCard
          label={t("patientSimilarity.common.patientB")}
          personId={result.person_b.person_id}
          ageBucket={result.person_b.age_bucket}
          genderConceptId={result.person_b.gender_concept_id}
          conditionCount={result.person_b.condition_count}
          labCount={result.person_b.lab_count}
          dimensionsAvailable={result.person_b.dimensions_available}
          sourceId={sourceId}
          accentColor="var(--accent)"
        />
      </div>

      {/* Overall similarity score */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("patientSimilarity.headToHead.overallSimilarity")}
        </div>
        <div className="flex items-end gap-3">
          <span
            className="text-5xl font-bold tabular-nums leading-none"
            style={{ color: scoreColor(overall_score) }}
          >
            {(overall_score * 100).toFixed(1)}
          </span>
          <span className="mb-1 text-lg text-text-ghost">%</span>
        </div>
        {/* Gradient progress bar */}
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${scoreGradient(overall_score)} transition-all duration-500`}
            style={{ width: `${Math.round(overall_score * 100)}%` }}
          />
        </div>
      </div>

      {/* Dimension scores — 2-column grid */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("patientSimilarity.headToHead.dimensionScores")}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {dimensionKeys.map((key) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-muted min-w-0 truncate">
                {getSimilarityDimensionLabel(t, key)}
              </span>
              <DimensionScoreBar
                score={dimension_scores[key]}
                label={getSimilarityDimensionLabel(t, key)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Shared features summary */}
      {(result.shared_features.condition_count > 0 ||
        result.shared_features.drug_count > 0 ||
        result.shared_features.procedure_count > 0) && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
            {t("patientSimilarity.headToHead.sharedFeatures")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SharedFeatureStat
              label={t("patientSimilarity.common.dimensions.conditions")}
              count={result.shared_features.condition_count}
              names={result.shared_features.condition_names}
              color="var(--primary)"
            />
            <SharedFeatureStat
              label={t("patientSimilarity.common.dimensions.medications")}
              count={result.shared_features.drug_count}
              names={result.shared_features.drug_names}
              color="var(--success)"
            />
            <SharedFeatureStat
              label={t("patientSimilarity.common.dimensions.procedures")}
              count={result.shared_features.procedure_count}
              names={result.shared_features.procedure_names}
              color="var(--accent)"
            />
          </div>
        </div>
      )}

      {/* Temporal trajectory */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("patientSimilarity.headToHead.temporalTrajectory")}
        </div>
        <TrajectoryComparison
          sourceId={sourceId}
          personAId={personAId}
          personBId={personBId}
        />
      </div>

      {/* Action links */}
      <div className="flex gap-3 pt-2">
        <a
          href={`/patient-profiles/${personAId}?source_id=${sourceId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-medium text-success hover:bg-success/20 transition-colors"
        >
          {t("patientSimilarity.headToHead.viewPatientAProfile")}
          <ExternalLink size={13} />
        </a>
        <a
          href={`/patient-profiles/${personBId}?source_id=${sourceId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
        >
          {t("patientSimilarity.headToHead.viewPatientBProfile")}
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

interface SharedFeatureStatProps {
  label: string;
  count: number;
  names?: { concept_id: number; name: string }[];
  color: string;
}

function SharedFeatureStat({ label, count, names, color }: SharedFeatureStatProps) {
  const { t } = useTranslation("app");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {count}
        </span>
      </div>
      {names && names.length > 0 && (
        <div className="space-y-0.5">
          {names.slice(0, 3).map((n) => (
            <div key={n.concept_id} className="truncate text-[10px] text-text-ghost" title={n.name}>
              {n.name}
            </div>
          ))}
          {names.length > 3 && (
            <div className="text-[10px] text-text-disabled">
              {t("patientSimilarity.similarityTable.more", {
                count: names.length - 3,
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DrawerBody({
  personAId,
  personBId,
  sourceId,
}: {
  personAId: number;
  personBId: number;
  sourceId: number;
}) {
  const { t } = useTranslation("app");
  const { data, isLoading, isError } = useComparePatients(personAId, personBId, sourceId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3">
        <Loader2 size={20} className="animate-spin text-success" />
        <span className="text-sm text-text-muted">
          {t("patientSimilarity.headToHead.loadingComparison", {
            defaultValue: "Loading comparison...",
          })}
        </span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <span className="text-sm text-text-muted">
          {t("patientSimilarity.headToHead.noComparisonData", {
            defaultValue: "No comparison data available.",
          })}
        </span>
        <span className="text-xs text-text-ghost">
          {t("patientSimilarity.headToHead.ensureVectors", {
            defaultValue:
              "Ensure both patients have feature vectors computed for this source.",
          })}
        </span>
      </div>
    );
  }

  return (
    <ComparisonContent
      result={data}
      personAId={personAId}
      personBId={personBId}
      sourceId={sourceId}
    />
  );
}

export function HeadToHeadDrawer({
  open,
  onClose,
  personAId,
  personBId,
  sourceId,
}: HeadToHeadDrawerProps) {
  const { t } = useTranslation("app");
  const title =
    personAId != null && personBId != null
      ? `${t("profiles.common.personLabel", { id: personAId })} vs ${t("profiles.common.personLabel", { id: personBId })}`
      : t("patientSimilarity.headToHead.title", {
          defaultValue: "Head-to-Head Comparison",
        });

  return (
    <Drawer open={open} onClose={onClose} title={title} size="lg">
      {personAId != null && personBId != null ? (
        <DrawerBody personAId={personAId} personBId={personBId} sourceId={sourceId} />
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-text-ghost">
          {t("patientSimilarity.headToHead.selectPatients", {
            defaultValue: "Select two patients to compare.",
          })}
        </div>
      )}
    </Drawer>
  );
}
