import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Award,
  BarChart3,
  Calculator,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  Lock,
  Play,
  Save,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { usePatientNotes, usePatientProfile } from "@/features/profiles/hooks/useProfiles";
import { useSourceStore } from "@/stores/sourceStore";
import {
  useComputePhenotypeValidationFromAdjudications,
  useExportPhenotypeValidationEvidence,
  usePhenotypeAdjudications,
  usePhenotypePromotions,
  usePhenotypeValidationQualitySummary,
  usePhenotypeValidations,
  usePromotePhenotypeValidation,
  useResolvePhenotypeAdjudication,
  useRunPhenotypeValidation,
  useSamplePhenotypeAdjudications,
  useUpdatePhenotypeAdjudication,
  useUpdatePhenotypeValidationReviewState,
} from "../hooks/useCohortDefinitions";
import type {
  CohortPhenotypeValidation,
  PhenotypeAdjudication,
  PhenotypeAdjudicationLabel,
  PhenotypeReviewState,
  PhenotypeSampleStrategy,
  PhenotypeValidationMetric,
} from "../types/cohortExpression";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

interface PhenotypeValidationPanelProps {
  definitionId: number;
}

type CountKey =
  | "true_positives"
  | "false_positives"
  | "true_negatives"
  | "false_negatives";

type ReviewFilter = "all" | "unreviewed" | "case" | "non_case" | "uncertain";

const COUNT_KEYS: CountKey[] = [
  "true_positives",
  "false_positives",
  "true_negatives",
  "false_negatives",
];

function getCountLabels(t: (key: string) => string): Record<CountKey, { label: string; help: string }> {
  return {
    true_positives: {
      label: t("cohortDefinitions.auto.truePositives_4fd14d"),
      help: "Confirmed cases captured by the cohort.",
    },
    false_positives: {
      label: t("cohortDefinitions.auto.falsePositives_b50c29"),
      help: "Cohort members that were not confirmed cases.",
    },
    true_negatives: {
      label: t("cohortDefinitions.auto.trueNegatives_8bdf10"),
      help: "Confirmed non-cases excluded by the cohort.",
    },
    false_negatives: {
      label: t("cohortDefinitions.auto.falseNegatives_6f8faf"),
      help: "Confirmed cases missed by the cohort.",
    },
  };
}

function getReviewFilters(t: (key: string) => string): Array<{ value: ReviewFilter; label: string }> {
  return [
    { value: "all", label: t("cohortDefinitions.auto.all_b1c94c") },
    { value: "unreviewed", label: t("cohortDefinitions.auto.unreviewed_8b87ba") },
    { value: "case", label: t("cohortDefinitions.auto.case_0819eb") },
    { value: "non_case", label: t("cohortDefinitions.auto.nonCase_29433c") },
    { value: "uncertain", label: t("cohortDefinitions.auto.uncertain_5fd617") },
  ];
}

function getReviewStateLabels(
  t: (key: string) => string,
): Record<PhenotypeReviewState, string> {
  return {
    draft: t("cohortDefinitions.auto.draft_f03ab1"),
    in_review: "In Review",
    completed: t("cohortDefinitions.auto.completed_07ca50"),
    locked: "Locked",
  };
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatCi(metric: PhenotypeValidationMetric | undefined): string | null {
  if (!metric || metric.ci_lower == null || metric.ci_upper == null) {
    return null;
  }

  return `${formatPercent(metric.ci_lower)} to ${formatPercent(metric.ci_upper)}`;
}

function StatusBadge({ status }: { status: CohortPhenotypeValidation["status"] }) {
  const isWorking = status === "queued" || status === "running" || status === "pending";
  const isDone = status === "completed";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium",
        isDone
          ? "bg-success/15 text-success"
          : isWorking
            ? "bg-accent/15 text-accent"
            : "bg-critical/15 text-critical",
      )}
    >
      {isDone ? (
        <CheckCircle2 size={11} />
      ) : isWorking ? (
        <Clock size={11} />
      ) : (
        <AlertCircle size={11} />
      )}
      {status}
    </span>
  );
}

function MetricCard({
  label,
  metric,
}: {
  label: string;
  metric?: PhenotypeValidationMetric;
}) {
  const { t } = useTranslation("app");
  const ci = formatCi(metric);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-3">
      <p className="text-[10px] font-medium uppercase text-text-ghost">
        {label}
      </p>
      <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-xl font-semibold text-text-primary">
        {formatPercent(metric?.estimate)}
      </p>
      {ci && (
        <p className="mt-1 text-[10px] text-text-muted">
          {t("cohortDefinitions.auto.95Ci_4009a0")} {ci}
        </p>
      )}
    </div>
  );
}

function labelButtonClass(active: boolean) {
  return cn(
    "rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
    active
      ? "border-success/40 bg-success/15 text-success"
      : "border-border-default bg-surface-base text-text-muted hover:text-text-primary",
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function PatientContextDrawer({
  sourceId,
  adjudication,
  onClose,
}: {
  sourceId: number;
  adjudication: PhenotypeAdjudication;
  onClose: () => void;
}) {
  const { t } = useTranslation("app");
  const profileQuery = usePatientProfile(sourceId, adjudication.person_id);
  const notesQuery = usePatientNotes(sourceId, adjudication.person_id, 1, 3);
  const profile = profileQuery.data;
  const demo = profile?.demographics;
  const recentEvents = useMemo(() => {
    if (!profile) return [];
    return [
      ...(profile.conditions ?? []),
      ...(profile.drugs ?? []),
      ...(profile.procedures ?? []),
      ...(profile.measurements ?? []),
      ...(profile.observations ?? []),
    ]
      .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))
      .slice(0, 10);
  }, [profile]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-border-default bg-surface-base shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-default bg-surface-raised px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {t("cohortDefinitions.auto.patient_01122a")} {adjudication.person_id}
            </p>
            <p className="text-xs text-text-muted">
              {adjudication.sample_group === "cohort_member" ? "Cohort member" : "Non-member"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {profileQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-ghost">
              <Loader2 size={12} className="animate-spin" />
              {t("cohortDefinitions.auto.loadingPatientContext_4e6133")}
            </div>
          ) : profileQuery.isError ? (
            <div className="rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
              {t("cohortDefinitions.auto.patientContextCouldNotBeLoaded_f522e4")}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border-default bg-surface-raised p-3">
                  <p className="text-[10px] text-text-ghost">{t("cohortDefinitions.auto.demographics_d6f6d1")}</p>
                  <p className="mt-1 text-sm text-text-primary">
                    {demo?.gender ?? "Unknown"}
                    {demo?.year_of_birth ? `, born ${demo.year_of_birth}` : ""}
                  </p>
                  <p className="text-xs text-text-muted">
                    {demo?.race ?? "Unknown race"} / {demo?.ethnicity ?? "Unknown ethnicity"}
                  </p>
                </div>
                <div className="rounded-lg border border-border-default bg-surface-raised p-3">
                  <p className="text-[10px] text-text-ghost">{t("cohortDefinitions.auto.recordCounts_020882")}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {t("cohortDefinitions.auto.conditions_229eb0")} {(profile?.conditions ?? []).length.toLocaleString()} {t("cohortDefinitions.auto.drugs_559833")} {(profile?.drugs ?? []).length.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t("cohortDefinitions.auto.procedures_5102ab")} {(profile?.procedures ?? []).length.toLocaleString()} {t("cohortDefinitions.auto.measurements_e8d8a3")} {(profile?.measurements ?? []).length.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border-default bg-surface-raised">
                <div className="border-b border-border-default px-3 py-2">
                  <h4 className="text-xs font-semibold text-text-primary">
                    {t("cohortDefinitions.auto.recentClinicalEvents_7a9ca1")}
                  </h4>
                </div>
                <div className="divide-y divide-border-subtle">
                  {recentEvents.length > 0 ? recentEvents.map((event, index) => (
                    <div key={`${event.domain}-${event.occurrence_id ?? index}`} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-medium text-text-primary">
                          {event.concept_name}
                        </p>
                        <span className="shrink-0 font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
                          {event.start_date}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted">
                        {event.domain}
                        {event.value != null ? ` · ${event.value}${event.unit ? ` ${event.unit}` : ""}` : ""}
                      </p>
                    </div>
                  )) : (
                    <p className="px-3 py-4 text-xs text-text-muted">
                      {t("cohortDefinitions.auto.noRecentEventsReturned_482741")}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border-default bg-surface-raised">
                <div className="flex items-center gap-2 border-b border-border-default px-3 py-2">
                  <FileText size={12} className="text-text-muted" />
                  <h4 className="text-xs font-semibold text-text-primary">
                    {t("cohortDefinitions.auto.recentNotes_062598")}
                  </h4>
                </div>
                <div className="divide-y divide-border-subtle">
                  {notesQuery.isLoading ? (
                    <div className="flex items-center gap-2 px-3 py-4 text-xs text-text-ghost">
                      <Loader2 size={12} className="animate-spin" />
                      {t("cohortDefinitions.auto.loadingNotes_1e22a9")}
                    </div>
                  ) : (notesQuery.data?.data ?? []).length > 0 ? (
                    notesQuery.data!.data.map((note) => (
                      <div key={note.note_id} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-xs font-medium text-text-primary">
                            {note.note_title ?? note.note_type ?? "Clinical note"}
                          </p>
                          <span className="shrink-0 font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
                            {note.note_date}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-text-muted">
                          {note.note_text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-xs text-text-muted">
                      {t("cohortDefinitions.auto.noNotesReturned_d3201d")}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ValidationResults({ validation }: { validation: CohortPhenotypeValidation }) {
  const { t } = useTranslation("app");
  const countLabels = getCountLabels(t);
  const result = validation.result_json;
  const metrics = result?.metrics;
  const counts = result?.counts ?? validation.settings_json?.counts;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-raised px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-success" />
          <span className="text-sm font-semibold text-text-primary">
            {t("cohortDefinitions.auto.latestValidation_1a18c5")}
          </span>
          <StatusBadge status={validation.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
          {validation.source?.source_name && (
            <span>{validation.source.source_name}</span>
          )}
          {result?.package_version && (
            <span className="rounded bg-surface-overlay px-1.5 py-0.5 font-['IBM_Plex_Mono',monospace]">
              {t("cohortDefinitions.auto.phevaluator_c08138")} {result.package_version}
            </span>
          )}
          {result?.elapsed_seconds != null && (
            <span className="font-['IBM_Plex_Mono',monospace]">
              {result.elapsed_seconds.toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {validation.status === "failed" && (
        <div className="rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
          {validation.fail_message ?? "Phenotype validation failed."}
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="PPV" metric={metrics.positive_predictive_value} />
          <MetricCard label="Sensitivity" metric={metrics.sensitivity} />
          <MetricCard label="Specificity" metric={metrics.specificity} />
          <MetricCard label="NPV" metric={metrics.negative_predictive_value} />
          <MetricCard label="F1 Score" metric={metrics.f1_score} />
          <MetricCard label="Estimated Prevalence" metric={metrics.estimated_prevalence} />
        </div>
      )}

      {counts && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h4 className="text-xs font-semibold text-text-primary">
            {t("cohortDefinitions.auto.adjudicatedCounts_51898c")}
          </h4>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COUNT_KEYS.map((key) => (
              <div key={key}>
                <p className="font-['IBM_Plex_Mono',monospace] text-lg font-semibold text-text-primary">
                  {counts[key].toLocaleString()}
                </p>
                <p className="text-[10px] text-text-muted">
                  {countLabels[key].label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PhenotypeValidationPanel({
  definitionId,
}: PhenotypeValidationPanelProps) {
  const { t } = useTranslation("app");
  const countLabels = getCountLabels(t);
  const reviewFilters = getReviewFilters(t);
  const reviewStateLabels = getReviewStateLabels(t);
  const navigate = useNavigate();
  const [sourceId, setSourceId] = useState<number | "">("");
  const [cohortMemberSample, setCohortMemberSample] = useState("25");
  const [nonMemberSample, setNonMemberSample] = useState("25");
  const [sampleSeed, setSampleSeed] = useState("");
  const [sampleStrategy, setSampleStrategy] =
    useState<PhenotypeSampleStrategy>("balanced_demographics");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [promotionNotes, setPromotionNotes] = useState("");
  const [contextAdjudication, setContextAdjudication] =
    useState<PhenotypeAdjudication | null>(null);
  const [counts, setCounts] = useState<Record<CountKey, string>>({
    true_positives: "0",
    false_positives: "0",
    true_negatives: "0",
    false_negatives: "0",
  });
  const [notes, setNotes] = useState("");

  const userDefaultSourceId = useSourceStore((s) => s.defaultSourceId);
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const validationsQuery = usePhenotypeValidations(definitionId);
  const reviewSession =
    validationsQuery.data?.items.find((item) => item.mode === "adjudication") ?? null;
  const adjudicationsQuery = usePhenotypeAdjudications(
    definitionId,
    reviewSession?.id ?? null,
    reviewFilter,
  );
  const runMutation = useRunPhenotypeValidation();
  const sampleMutation = useSamplePhenotypeAdjudications();
  const updateAdjudicationMutation = useUpdatePhenotypeAdjudication();
  const resolveAdjudicationMutation = useResolvePhenotypeAdjudication();
  const computeMutation = useComputePhenotypeValidationFromAdjudications();
  const updateReviewStateMutation = useUpdatePhenotypeValidationReviewState();
  const exportEvidenceMutation = useExportPhenotypeValidationEvidence();
  const promoteMutation = usePromotePhenotypeValidation();
  const promotionsQuery = usePhenotypePromotions(definitionId);
  const qualityQuery = usePhenotypeValidationQualitySummary(
    definitionId,
    reviewSession?.id ?? null,
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (sourceId || !sources || sources.length === 0) return;
    const defaultSource =
      (userDefaultSourceId ? sources.find((s) => s.id === userDefaultSourceId) : null)
      ?? sources[0];
    setSourceId(defaultSource.id);
  }, [sourceId, sources, userDefaultSourceId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const parsedCounts = useMemo(
    () =>
      Object.fromEntries(
        COUNT_KEYS.map((key) => [
          key,
          Math.max(0, Number.parseInt(counts[key] || "0", 10) || 0),
        ]),
      ) as Record<CountKey, number>,
    [counts],
  );

  const total = Object.values(parsedCounts).reduce((sum, value) => sum + value, 0);
  const latest = validationsQuery.data?.items?.[0] ?? null;
  const adjudications = adjudicationsQuery.data?.items ?? [];
  const memberRows = adjudications.filter((item) => item.sample_group === "cohort_member");
  const nonMemberRows = adjudications.filter((item) => item.sample_group === "non_member");
  const currentReviewed = adjudications.filter((item) => item.label === "case" || item.label === "non_case");
  const currentUnreviewed = adjudications.filter((item) => item.label == null);
  const currentUncertain = adjudications.filter((item) => item.label === "uncertain");
  const reviewedCount =
    reviewSession?.reviewed_adjudications_count
    ?? adjudications.filter((item) => item.label === "case" || item.label === "non_case").length;
  const adjudicationTotal = reviewSession?.adjudications_count ?? adjudications.length;
  const reviewState = (reviewSession?.settings_json?.review_state ?? "draft") as PhenotypeReviewState;
  const reviewIsReadOnly = reviewState === "completed" || reviewState === "locked";
  const reviewIsLocked = reviewState === "locked";
  const latestSample = reviewSession?.settings_json?.latest_sample ?? null;
  const agreement = qualityQuery.data?.agreement ?? reviewSession?.settings_json?.agreement_summary ?? null;
  const promotionReady =
    !!reviewSession
    && (reviewState === "completed" || reviewState === "locked")
    && agreement?.ready_for_promotion === true
    && reviewSession.status === "completed"
    && reviewSession.result_json?.status === "completed";
  const promotions = promotionsQuery.data ?? [];

  const handleRun = () => {
    if (!sourceId || total === 0) return;

    runMutation.mutate({
      defId: definitionId,
      payload: {
        source_id: sourceId,
        mode: "counts",
        counts: parsedCounts,
        notes: notes.trim() || undefined,
      },
    });
  };

  const handleStartReview = () => {
    if (!sourceId) return;
    runMutation.mutate({
      defId: definitionId,
      payload: {
        source_id: sourceId,
        mode: "adjudication",
        notes: notes.trim() || undefined,
      },
    });
  };

  const handleSample = () => {
    if (!reviewSession) return;
    sampleMutation.mutate({
      defId: definitionId,
      validationId: reviewSession.id,
      payload: {
        cohort_member_count: Math.max(0, Number.parseInt(cohortMemberSample || "0", 10) || 0),
        non_member_count: Math.max(0, Number.parseInt(nonMemberSample || "0", 10) || 0),
        seed: sampleSeed.trim() || undefined,
        strategy: sampleStrategy,
      },
    });
  };

  const handleLabel = (
    item: PhenotypeAdjudication,
    label: PhenotypeAdjudicationLabel,
  ) => {
    if (!reviewSession) return;
    updateAdjudicationMutation.mutate({
      defId: definitionId,
      validationId: reviewSession.id,
      adjudicationId: item.id,
      label,
      notes: item.notes,
    });
  };

  const handleSaveNote = (item: PhenotypeAdjudication) => {
    if (!reviewSession) return;
    updateAdjudicationMutation.mutate({
      defId: definitionId,
      validationId: reviewSession.id,
      adjudicationId: item.id,
      label: item.label,
      notes: noteDrafts[item.id] ?? item.notes ?? "",
    });
  };

  const handleCompute = () => {
    if (!reviewSession) return;
    computeMutation.mutate({
      defId: definitionId,
      validationId: reviewSession.id,
    });
  };

  const handleResolve = (
    item: PhenotypeAdjudication,
    label: Exclude<PhenotypeAdjudicationLabel, null>,
  ) => {
    if (!reviewSession) return;
    resolveAdjudicationMutation.mutate({
      defId: definitionId,
      validationId: reviewSession.id,
      adjudicationId: item.id,
      label,
      notes: noteDrafts[item.id] ?? item.notes ?? "",
    });
  };

  const handleReviewState = (reviewState: PhenotypeReviewState) => {
    if (!reviewSession) return;
    updateReviewStateMutation.mutate({
      defId: definitionId,
      validationId: reviewSession.id,
      reviewState,
    });
  };

  const handleExportEvidence = () => {
    if (!reviewSession) return;
    exportEvidenceMutation.mutate(
      {
        defId: definitionId,
        validationId: reviewSession.id,
      },
      {
        onSuccess: (payload) => {
          const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
          });
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `phenotype-validation-${reviewSession.id}-evidence.json`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.URL.revokeObjectURL(url);
        },
      },
    );
  };

  const handlePromote = () => {
    if (!reviewSession || !promotionReady) return;
    promoteMutation.mutate({
      defId: definitionId,
      validationId: reviewSession.id,
      approvalNotes: promotionNotes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {contextAdjudication && reviewSession && (
        <PatientContextDrawer
          sourceId={reviewSession.source_id}
          adjudication={contextAdjudication}
          onClose={() => setContextAdjudication(null)}
        />
      )}

      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="flex items-center gap-2 border-b border-border-default bg-surface-overlay px-4 py-3">
          <UserCheck size={14} className="text-success" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t("cohortDefinitions.auto.nativeReviewQueue_1d8fea")}
          </h3>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-success/15 text-success">
            preferred
          </span>
        </div>

        <div className="space-y-4 p-4">
          {!reviewSession ? (
            <div className="space-y-4">
              <p className="text-xs text-text-muted">
                {t("cohortDefinitions.auto.createAReviewSessionSampleCohortMembersAnd_a0f199")}
              </p>
              <button
                type="button"
                onClick={handleStartReview}
                disabled={!sourceId || runMutation.isPending}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  sourceId && !runMutation.isPending
                    ? "bg-success text-surface-base hover:bg-success-dark"
                    : "border border-border-default bg-surface-overlay text-text-ghost cursor-not-allowed",
                )}
              >
                {runMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserCheck size={14} />
                )}
                {t("cohortDefinitions.auto.startReviewSession_dbad26")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="font-['IBM_Plex_Mono',monospace] text-lg font-semibold text-text-primary">
                    {adjudicationTotal.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.sampledCharts_53f635")}</p>
                </div>
                <div className="rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="font-['IBM_Plex_Mono',monospace] text-lg font-semibold text-text-primary">
                    {reviewedCount.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.caseNonCaseLabels_84e1ef")}</p>
                </div>
                <div className="rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="font-['IBM_Plex_Mono',monospace] text-lg font-semibold text-text-primary">
                    {reviewSession.source?.source_name ?? "Source"}
                  </p>
                  <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.reviewSource_a2d4bf")}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border-default bg-surface-base p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase text-text-ghost">
                      {t("cohortDefinitions.auto.reviewLifecycle_5dead3")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {reviewStateLabels[reviewState] ?? reviewState}
                    </p>
                    {latestSample && (
                      <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-[10px] text-text-muted">
                        seed {latestSample.seed} · {latestSample.strategy.replace("_", " ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleReviewState("completed")}
                      disabled={
                        reviewState !== "in_review"
                        || updateReviewStateMutation.isPending
                        || agreement?.ready_for_promotion !== true
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-raised px-2.5 py-1.5 text-[10px] font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
                    >
                      <CheckCircle2 size={11} />
                      {t("cohortDefinitions.auto.complete_ae94f8")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewState("locked")}
                      disabled={reviewState !== "completed" || updateReviewStateMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-raised px-2.5 py-1.5 text-[10px] font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
                    >
                      <Lock size={11} />
                      {t("cohortDefinitions.auto.lock_b48516")}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportEvidence}
                      disabled={exportEvidenceMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-raised px-2.5 py-1.5 text-[10px] font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
                    >
                      {exportEvidenceMutation.isPending ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Download size={11} />
                      )}
                      {t("cohortDefinitions.auto.exportEvidence_65ee0d")}
                    </button>
                  </div>
                </div>
              </div>

              {agreement && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <div className="rounded-lg border border-border-default bg-surface-base p-3">
                    <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                      {agreement.review_records.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.reviewRecords_c283f1")}</p>
                  </div>
                  <div className="rounded-lg border border-border-default bg-surface-base p-3">
                    <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                      {agreement.double_reviewed_adjudications.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.doubleReviewed_d24d8a")}</p>
                  </div>
                  <div className="rounded-lg border border-border-default bg-surface-base p-3">
                    <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                      {agreement.unresolved_conflict_adjudications.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.unresolvedConflicts_f3843b")}</p>
                  </div>
                  <div className="rounded-lg border border-border-default bg-surface-base p-3">
                    <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                      {formatPercent(agreement.observed_pairwise_agreement)}
                    </p>
                    <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.pairwiseAgreement_33e604")}</p>
                  </div>
                  <div className="rounded-lg border border-border-default bg-surface-base p-3">
                    <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                      {agreement.cohen_kappa == null ? "—" : agreement.cohen_kappa.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-text-muted">kappa</p>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border-default bg-surface-base p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Award size={13} className="text-accent" />
                      <p className="text-xs font-semibold text-text-primary">
                        {t("cohortDefinitions.auto.promotionGovernance_f37ea1")}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px] text-text-muted">
                      {t("cohortDefinitions.auto.requiresCompletedReviewQualityAndCompletedPhevaluatorMetrics_02e8bd")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      <span className={cn(
                        "rounded px-1.5 py-0.5",
                        reviewState === "completed" || reviewState === "locked"
                          ? "bg-success/15 text-success"
                          : "bg-surface-overlay text-text-ghost",
                      )}>
                        {t("cohortDefinitions.auto.reviewComplete_1c2830")}
                      </span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5",
                        agreement?.ready_for_promotion
                          ? "bg-success/15 text-success"
                          : "bg-surface-overlay text-text-ghost",
                      )}>
                        {t("cohortDefinitions.auto.qualityReady_1dde62")}
                      </span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5",
                        reviewSession.status === "completed" && reviewSession.result_json?.status === "completed"
                          ? "bg-success/15 text-success"
                          : "bg-surface-overlay text-text-ghost",
                      )}>
                        {t("cohortDefinitions.auto.metricsComplete_ff7dd3")}
                      </span>
                    </div>
                  </div>
                  <div className="w-full max-w-md space-y-2">
                    <textarea
                      value={promotionNotes}
                      onChange={(event) => setPromotionNotes(event.target.value)}
                      rows={2}
                      placeholder={t("cohortDefinitions.auto.approvalNotes_8b0b3f")}
                      className="w-full resize-none rounded-md border border-border-default bg-surface-raised px-3 py-2 text-xs text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success"
                    />
                    <button
                      type="button"
                      onClick={handlePromote}
                      disabled={!promotionReady || promoteMutation.isPending}
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors",
                        promotionReady && !promoteMutation.isPending
                          ? "bg-accent text-surface-base hover:bg-accent/80"
                          : "border border-border-default bg-surface-overlay text-text-ghost cursor-not-allowed",
                      )}
                    >
                      {promoteMutation.isPending ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Award size={13} />
                      )}
                      {t("cohortDefinitions.auto.promoteToValidated_ac436a")}
                    </button>
                  </div>
                </div>
                {promoteMutation.isError && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {promoteMutation.error instanceof Error
                        ? promoteMutation.error.message
                        : "Failed to promote phenotype."}
                    </span>
                  </div>
                )}
                {promotions.length > 0 && (
                  <div className="mt-3 border-t border-border-subtle pt-3">
                    <p className="text-[10px] font-medium uppercase text-text-ghost">
                      {t("cohortDefinitions.auto.promotionHistory_43e62c")}
                    </p>
                    <div className="mt-2 space-y-1">
                      {promotions.slice(0, 3).map((promotion) => (
                        <div key={promotion.id} className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-muted">
                          <span>
                            {promotion.approver?.name ?? "Approver"} {t("cohortDefinitions.auto.promotedValidation_f5525e")} {promotion.phenotype_validation_id}
                          </span>
                          <span className="font-['IBM_Plex_Mono',monospace] text-text-ghost">
                            {formatDateTime(promotion.promoted_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div className="rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                    {memberRows.length.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.membersInView_e7fcb5")}</p>
                </div>
                <div className="rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                    {nonMemberRows.length.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.nonMembersInView_d2e29e")}</p>
                </div>
                <div className="rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                    {currentReviewed.length.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.reviewedInView_a342f5")}</p>
                </div>
                <div className="rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                    {currentUnreviewed.length.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.unreviewedInView_182172")}</p>
                </div>
                <div className="rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="font-['IBM_Plex_Mono',monospace] text-base font-semibold text-text-primary">
                    {currentUncertain.length.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">{t("cohortDefinitions.auto.uncertainInView_0769e9")}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-text-muted">
                    {t("cohortDefinitions.auto.cohortMembers_135b3f")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={cohortMemberSample}
                    onChange={(event) => setCohortMemberSample(event.target.value)}
                    className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 font-['IBM_Plex_Mono',monospace] text-sm text-text-primary focus:outline-none focus:border-success"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-text-muted">
                    {t("cohortDefinitions.auto.nonMembers_575227")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={nonMemberSample}
                    onChange={(event) => setNonMemberSample(event.target.value)}
                    className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 font-['IBM_Plex_Mono',monospace] text-sm text-text-primary focus:outline-none focus:border-success"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-text-muted">
                    {t("cohortDefinitions.auto.seed_dba005")}
                  </span>
                  <input
                    type="text"
                    value={sampleSeed}
                    onChange={(event) => setSampleSeed(event.target.value)}
                    placeholder="auto"
                    className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 font-['IBM_Plex_Mono',monospace] text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-text-muted">
                    {t("cohortDefinitions.auto.strategy_83de19")}
                  </span>
                  <select
                    value={sampleStrategy}
                    onChange={(event) =>
                      setSampleStrategy(event.target.value as PhenotypeSampleStrategy)
                    }
                    className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success"
                  >
                    <option value="balanced_demographics">{t("cohortDefinitions.auto.balancedDemographics_d64a2d")}</option>
                    <option value="random">{t("cohortDefinitions.auto.seededRandom_0e39c4")}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleSample}
                  disabled={sampleMutation.isPending || reviewIsReadOnly}
                  className="self-end inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-base px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-50"
                >
                  {sampleMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Users size={14} />
                  )}
                  {t("cohortDefinitions.auto.sample_c5dd1b")}
                </button>
              </div>

              {sampleMutation.isError && (
                <div className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span>
                    {sampleMutation.error instanceof Error
                      ? sampleMutation.error.message
                      : "Failed to create review sample."}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <Filter size={12} />
                  {t("cohortDefinitions.auto.queueFilter_3f520f")}
                </div>
                {reviewFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setReviewFilter(filter.value)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                      reviewFilter === filter.value
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border-default bg-surface-base text-text-muted hover:text-text-primary",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {adjudicationsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-text-ghost">
                  <Loader2 size={12} className="animate-spin" />
                  {t("cohortDefinitions.auto.loadingReviewQueue_da5be8")}
                </div>
              ) : adjudications.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border-default">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-overlay text-text-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.patient_01122a")}</th>
                        <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.sample_c5dd1b")}</th>
                        <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.demographics_d6f6d1")}</th>
                        <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.label_b021df")}</th>
                        <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.reviewer_8e58cd")}</th>
                        <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.notes_f4c6f8")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("cohortDefinitions.auto.profile_cce99c")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjudications.map((item) => {
                        const definitiveLabels = (item.reviews ?? [])
                          .map((review) => review.label)
                          .filter((label) => label === "case" || label === "non_case");
                        const hasConflict =
                          new Set(definitiveLabels).size > 1 && item.label == null;

                        return (
                        <tr key={item.id} className="border-t border-border-subtle">
                          <td className="px-3 py-2 font-['IBM_Plex_Mono',monospace] text-text-primary">
                            {item.person_id}
                          </td>
                          <td className="px-3 py-2 text-text-muted">
                            <p>{item.sample_group === "cohort_member" ? "Member" : "Non-member"}</p>
                            {item.sampling_json?.stratum && (
                              <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
                                {item.sampling_json.stratum}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-text-muted">
                            {item.demographics_json?.gender ?? "Unknown"}
                            {item.demographics_json?.year_of_birth
                              ? `, born ${item.demographics_json.year_of_birth}`
                              : ""}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => handleLabel(item, "case")}
                                disabled={reviewIsReadOnly}
                                className={labelButtonClass(item.label === "case")}
                              >
                                {t("cohortDefinitions.auto.case_0819eb")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLabel(item, "non_case")}
                                disabled={reviewIsReadOnly}
                                className={labelButtonClass(item.label === "non_case")}
                              >
                                {t("cohortDefinitions.auto.nonCase_29433c")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLabel(item, "uncertain")}
                                disabled={reviewIsReadOnly}
                                className={labelButtonClass(item.label === "uncertain")}
                              >
                                {t("cohortDefinitions.auto.uncertain_5fd617")}
                              </button>
                            </div>
                            {hasConflict && (
                              <div className="mt-2 rounded-md border border-critical/30 bg-critical/10 p-2">
                                <p className="text-[10px] font-medium text-critical">
                                  {t("cohortDefinitions.auto.reviewerConflict_15d048")}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleResolve(item, "case")}
                                    disabled={reviewIsReadOnly || resolveAdjudicationMutation.isPending}
                                    className="rounded-md border border-border-default bg-surface-base px-2 py-1 text-[10px] text-text-muted hover:text-text-primary disabled:opacity-50"
                                  >
                                    {t("cohortDefinitions.auto.resolveCase_22fafd")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolve(item, "non_case")}
                                    disabled={reviewIsReadOnly || resolveAdjudicationMutation.isPending}
                                    className="rounded-md border border-border-default bg-surface-base px-2 py-1 text-[10px] text-text-muted hover:text-text-primary disabled:opacity-50"
                                  >
                                    {t("cohortDefinitions.auto.resolveNonCase_3aab77")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-text-muted">
                            <p>{item.reviewer?.name ?? "—"}</p>
                            <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
                              {formatDateTime(item.reviewed_at)}
                            </p>
                            {item.events && item.events.length > 0 && (
                              <p className="mt-1 text-[10px] text-text-ghost">
                                {item.events.length} {t("cohortDefinitions.auto.auditEvent_aeb01c")}{item.events.length === 1 ? "" : "s"}
                              </p>
                            )}
                            {(item.reviews ?? []).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {(item.reviews ?? []).slice(0, 3).map((review) => (
                                  <p key={review.id} className="text-[10px] text-text-ghost">
                                    {review.reviewer?.name ?? "Reviewer"}: {review.label ?? "pending"}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="min-w-64 px-3 py-2">
                            <textarea
                              value={noteDrafts[item.id] ?? item.notes ?? ""}
                              onChange={(event) =>
                                setNoteDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value,
                                }))
                              }
                              rows={2}
                              placeholder={t("cohortDefinitions.auto.reviewNote_a4d05d")}
                              className="w-full resize-none rounded-md border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNote(item)}
                              disabled={updateAdjudicationMutation.isPending || reviewIsReadOnly}
                              className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted hover:bg-surface-elevated hover:text-text-primary transition-colors disabled:opacity-50"
                            >
                              <Save size={11} />
                              {t("cohortDefinitions.auto.saveNote_55ee21")}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setContextAdjudication(item)}
                              className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted hover:bg-surface-elevated hover:text-text-primary transition-colors"
                            >
                              <FileText size={11} />
                              {t("cohortDefinitions.auto.context_ad4e20")}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/profiles/${item.person_id}?sourceId=${reviewSession.source_id}`)
                              }
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted hover:bg-surface-elevated hover:text-text-primary transition-colors"
                            >
                              <Eye size={11} />
                              {t("cohortDefinitions.auto.open_c3bf44")}
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-surface-highlight bg-surface-base px-4 py-6 text-center text-xs text-text-muted">
                  {t("cohortDefinitions.auto.noChartsSampledYet_d90fef")}
                </div>
              )}

              <button
                type="button"
                onClick={handleCompute}
                disabled={reviewedCount === 0 || computeMutation.isPending || reviewIsLocked}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  reviewedCount > 0 && !computeMutation.isPending && !reviewIsLocked
                    ? "bg-primary text-primary-foreground hover:bg-primary/80"
                    : "border border-border-default bg-surface-overlay text-text-ghost cursor-not-allowed",
                )}
              >
                {computeMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Calculator size={14} />
                )}
                {t("cohortDefinitions.auto.computeMetricsFromReview_f4671d")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="flex items-center gap-2 border-b border-border-default bg-surface-overlay px-4 py-3">
          <BarChart3 size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t("cohortDefinitions.auto.phenotypeValidation_65de7c")}
          </h3>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-primary/15 text-primary">
            {t("cohortDefinitions.auto.phevaluator_c08138")}
          </span>
        </div>

        <div className="space-y-5 p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">
              {t("cohortDefinitions.auto.dataSource_338880")}
            </label>
            {sourcesLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-ghost">
                <Loader2 size={12} className="animate-spin" />
                {t("cohortDefinitions.auto.loadingSources_9e86c0")}
              </div>
            ) : !sources || sources.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-critical">
                <AlertCircle size={12} />
                {t("cohortDefinitions.auto.noDataSourcesConfigured_2559a2")}
              </div>
            ) : (
              <select
                value={sourceId}
                onChange={(event) => setSourceId(Number(event.target.value))}
                className={cn(
                  "w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary",
                  "focus:outline-none focus:border-success transition-colors",
                )}
              >
                <option value="" disabled>
                  {t("cohortDefinitions.auto.selectASource_86ba80")}
                </option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.source_name}
                    {source.id === userDefaultSourceId ? " (default)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COUNT_KEYS.map((key) => (
              <label key={key} className="space-y-1.5">
                <span className="text-xs font-medium text-text-muted">
                  {countLabels[key].label}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={counts[key]}
                  onChange={(event) =>
                    setCounts((prev) => ({
                      ...prev,
                      [key]: event.target.value,
                    }))
                  }
                  className={cn(
                    "w-full rounded-md border border-border-default bg-surface-base px-3 py-2",
                    "font-['IBM_Plex_Mono',monospace] text-sm text-text-primary",
                    "focus:outline-none focus:border-success transition-colors",
                  )}
                />
                <span className="block text-[10px] text-text-ghost">
                  {countLabels[key].help}
                </span>
              </label>
            ))}
          </div>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-muted">
              {t("cohortDefinitions.auto.notes_f4c6f8")}
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder={t("cohortDefinitions.auto.referenceSetReviewerSamplingMethod_089b48")}
              className={cn(
                "w-full resize-none rounded-md border border-border-default bg-surface-base px-3 py-2",
                "text-sm text-text-primary placeholder:text-text-ghost",
                "focus:outline-none focus:border-success transition-colors",
              )}
            />
          </label>

          {runMutation.isError && (
            <div className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>
                {runMutation.error instanceof Error
                  ? runMutation.error.message
                  : "Failed to queue phenotype validation."}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRun}
            disabled={!sourceId || total === 0 || runMutation.isPending}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              sourceId && total > 0 && !runMutation.isPending
                ? "bg-primary text-primary-foreground hover:bg-primary/80"
                : "border border-border-default bg-surface-overlay text-text-ghost cursor-not-allowed",
            )}
          >
            {runMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {t("cohortDefinitions.auto.runValidation_10814a")}
          </button>

          <p className="text-center text-[10px] text-text-ghost">
            {t("cohortDefinitions.auto.countBasedValidationUsesAdjudicatedReferenceLabelsAnd_29f035")}
          </p>
        </div>
      </div>

      {validationsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-text-ghost">
          <Loader2 size={12} className="animate-spin" />
          {t("cohortDefinitions.auto.loadingValidationHistory_86f943")}
        </div>
      ) : latest ? (
        <ValidationResults validation={latest} />
      ) : (
        <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-6 text-center text-xs text-text-muted">
          {t("cohortDefinitions.auto.noPhenotypeValidationsHaveBeenRunForThis_463c58")}
        </div>
      )}

      {validationsQuery.data?.items && validationsQuery.data.items.length > 1 && (
        <div className="rounded-lg border border-border-default bg-surface-raised">
          <div className="border-b border-border-default px-4 py-3">
            <h4 className="text-xs font-semibold text-text-primary">
              {t("cohortDefinitions.auto.validationHistory_f95871")}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted">
                  <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.run_c53016")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.status_ec53a8")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("cohortDefinitions.auto.source_f31bbd")}</th>
                  <th className="px-3 py-2 text-right font-medium">PPV</th>
                  <th className="px-3 py-2 text-right font-medium">{t("cohortDefinitions.auto.sensitivity_456ce8")}</th>
                </tr>
              </thead>
              <tbody>
                {validationsQuery.data.items.slice(1, 8).map((validation) => (
                  <tr key={validation.id} className="border-b border-border-subtle">
                    <td className="px-3 py-2 text-text-secondary">
                      {new Date(validation.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={validation.status} />
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {validation.source?.source_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-primary">
                      {formatPercent(validation.result_json?.metrics?.positive_predictive_value?.estimate)}
                    </td>
                    <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-primary">
                      {formatPercent(validation.result_json?.metrics?.sensitivity?.estimate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
