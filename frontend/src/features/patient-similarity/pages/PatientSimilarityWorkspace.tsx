import { type ReactNode, useState, useCallback, useMemo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usePipeline } from '../hooks/usePipeline';
import {
  useCompareCohorts,
  usePropensityMatch,
  useCohortProfile,
  useCohortSimilaritySearch,
  useNetworkFusion,
  usePhenotypeDiscovery,
} from '../hooks/usePatientSimilarity';
import { projectPatientLandscape } from '../api/patientSimilarityApi';
import { useCohortDefinitions } from '@/features/cohort-definitions/hooks/useCohortDefinitions';
import { useSourceStore } from '@/stores/sourceStore';
import { CohortSelectorBar } from '../components/CohortSelectorBar';
import { AnalysisPipeline } from '../components/AnalysisPipeline';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { ProfileComparisonPanel } from '../components/ProfileComparisonPanel';
import { CovariateBalancePanel } from '../components/CovariateBalancePanel';
import { PsmPanel } from '../components/PsmPanel';
import { LandscapePanel } from '../components/LandscapePanel';
import { HeadToHeadDrawer } from '../components/HeadToHeadDrawer';
import { SimilarityModeToggle } from '../components/SimilarityModeToggle';
import { CentroidProfilePanel } from '../components/CentroidProfilePanel';
import { SimilarPatientsPanel } from '../components/SimilarPatientsPanel';
import { PhenotypeDiscoveryPanel } from '../components/PhenotypeDiscoveryPanel';
import { HelpButton } from '@/features/help';
import { NetworkFusionPanel } from '../components/NetworkFusionPanel';
import type {
  CohortComparisonResult,
  CohortProfileResult,
  SimilaritySearchResult,
  CovariateBalanceRow,
  PropensityMatchResult,
  LandscapeResult,
  LandscapeParams,
  PhenotypeDiscoveryResult,
  NetworkFusionResult,
} from '../types/patientSimilarity';
import type { PipelineMode } from '../types/pipeline';

function buildBalanceSummary(covariates: CovariateBalanceRow[]): string {
  const total = covariates.length;
  const imbalanced = covariates.filter((c) => Math.abs(c.smd) >= 0.1);
  if (total === 0) return 'No covariate data';
  const worst =
    imbalanced.length > 0
      ? imbalanced.reduce((a, b) => (Math.abs(b.smd) > Math.abs(a.smd) ? b : a))
      : null;
  return `${imbalanced.length}/${total} covariates imbalanced${
    worst ? ` \u00b7 worst: ${worst.covariate} (SMD ${Math.abs(worst.smd).toFixed(2)})` : ''
  }`;
}

export default function PatientSimilarityWorkspace() {
  const { activeSourceId, setActiveSource } = useSourceStore();

  const [sourceIdOverride, setSourceIdOverride] = useState<number | null>(null);
  const sourceId = sourceIdOverride ?? activeSourceId;
  const [targetCohortId, setTargetCohortId] = useState<number | null>(null);
  const [comparatorCohortId, setComparatorCohortId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [h2hOpen, setH2hOpen] = useState(false);
  const [h2hPersonA, _setH2hPersonA] = useState<number | null>(null);
  const [h2hPersonB, _setH2hPersonB] = useState<number | null>(null);
  // Settings drawer state
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [ageMin, setAgeMin] = useState(0);
  const [ageMax, setAgeMax] = useState(150);
  const [gender, setGender] = useState('');
  const [similarityMode, setSimilarityMode] = useState<'auto' | 'interpretable' | 'embedding'>('auto');

  const pipeline = usePipeline();
  const compareMutation = useCompareCohorts();
  const psmMutation = usePropensityMatch();
  const cohortProfileQuery = useCohortProfile(
    pipeline.mode === 'expand' ? (targetCohortId ?? undefined) : undefined,
    sourceId ?? 0,
  );
  const cohortSimilarityMutation = useCohortSimilaritySearch();
  const landscapeMutation = useMutation({
    mutationFn: (params: LandscapeParams) => projectPatientLandscape(params),
  });
  const phenotypeMutation = usePhenotypeDiscovery();
  const snfMutation = useNetworkFusion();

  // Resolve centroid step when profile query completes (fixes race condition in expand mode)
  useEffect(() => {
    if (
      pipeline.mode === 'expand' &&
      cohortProfileQuery.data &&
      pipeline.getStepStatus('centroid') === 'loading'
    ) {
      const profile = cohortProfileQuery.data;
      pipeline.markCompleted('centroid', {
        data: profile,
        summary: `${profile.member_count} members · ${Object.keys(profile.dimensions).length} dimensions`,
        executionTimeMs: 0,
        completedAt: new Date(),
      });
    }
  }, [pipeline, cohortProfileQuery.data]);

  const { data: cohortsData } = useCohortDefinitions({ limit: 500 });
  const cohorts = useMemo(() => cohortsData?.items ?? [], [cohortsData]);

  const getCohortName = useCallback(
    (id: number | null) => {
      if (id == null) return 'Unknown';
      return cohorts.find((c) => c.id === id)?.name ?? `Cohort ${id}`;
    },
    [cohorts],
  );

  // ── Handlers ──────────────────────────────────────────────────────

  const handleSourceChange = useCallback(
    (id: number) => {
      setSourceIdOverride(id);
      setActiveSource(id);
      setTargetCohortId(null);
      setComparatorCohortId(null);
      pipeline.resetPipeline();
    },
    [setActiveSource, pipeline],
  );

  const handleTargetChange = useCallback(
    (id: number | null) => {
      setTargetCohortId(id);
      pipeline.resetPipeline();
    },
    [pipeline],
  );

  const handleComparatorChange = useCallback(
    (id: number | null) => {
      setComparatorCohortId(id);
      pipeline.resetPipeline();
    },
    [pipeline],
  );

  const handleModeChange = useCallback(
    (mode: PipelineMode) => {
      pipeline.setMode(mode);
      setComparatorCohortId(null);
    },
    [pipeline],
  );

  const handleCompare = useCallback(() => {
    if (sourceId == null || targetCohortId == null) return;

    // ── Expand mode ───────────────────────────────────────────────
    if (pipeline.mode === 'expand') {
      pipeline.resetPipeline();

      // Step 1: cohort profile — use cached query data if already available,
      // otherwise wait for the query (enabled when mode === 'expand' and IDs are set).
      const profileData = cohortProfileQuery.data;
      if (profileData) {
        pipeline.markCompleted('centroid', {
          data: profileData,
          summary: `${profileData.member_count} members · ${Object.keys(profileData.dimensions).length} dimensions`,
          executionTimeMs: 0,
          completedAt: new Date(),
        });
      } else {
        pipeline.markLoading('centroid');
        // The query is already running via useCohortProfile; we re-use its result
        // by observing in renderStepContent once available. We mark centroid completed
        // here optimistically only when data is cached; otherwise the user sees the
        // loading state via AnalysisPipeline until the query resolves.
        // Re-trigger by polling would complicate things — instead surface the query
        // status through the pipeline once it resolves (handled via useEffect-free
        // imperative path: mark complete when mutation chain runs).
      }

      // Step 2: cohort similarity search
      pipeline.markLoading('similar');
      const startMs = performance.now();
      cohortSimilarityMutation.mutate(
        {
          cohort_definition_id: targetCohortId,
          source_id: sourceId,
          weights,
        },
        {
          onSuccess: (searchResult: SimilaritySearchResult) => {
            const elapsedMs = Math.round(performance.now() - startMs);

            // Resolve centroid step if the query data is now available
            const freshProfile = cohortProfileQuery.data;
            if (freshProfile && pipeline.getStepStatus('centroid') !== 'completed') {
              pipeline.markCompleted('centroid', {
                data: freshProfile,
                summary: `${freshProfile.member_count} members · ${Object.keys(freshProfile.dimensions).length} dimensions`,
                executionTimeMs: 0,
                completedAt: new Date(),
              });
            }

            pipeline.markCompleted('similar', {
              data: searchResult,
              summary: `${searchResult.similar_patients.length} similar patients found`,
              executionTimeMs: elapsedMs,
              completedAt: new Date(),
            });
          },
          onError: () => {
            pipeline.markError('similar');
          },
        },
      );
      return;
    }

    // ── Compare mode ──────────────────────────────────────────────
    if (comparatorCohortId == null) return;

    pipeline.resetPipeline();
    pipeline.markLoading('profile');

    const startMs = performance.now();

    compareMutation.mutate(
      {
        source_cohort_id: targetCohortId,
        target_cohort_id: comparatorCohortId,
        source_id: sourceId,
      },
      {
        onSuccess: (data: CohortComparisonResult) => {
          const elapsedMs = Math.round(performance.now() - startMs);
          const overallPct = Math.round(data.overall_divergence * 100);

          pipeline.markCompleted('profile', {
            data,
            summary: `Overall divergence ${overallPct}%`,
            executionTimeMs: elapsedMs,
            completedAt: new Date(),
          });

          const covariates = data.covariates ?? [];
          pipeline.markCompleted('balance', {
            data,
            summary: buildBalanceSummary(covariates),
            executionTimeMs: elapsedMs,
            completedAt: new Date(),
          });
        },
        onError: () => {
          pipeline.markError('profile');
        },
      },
    );
  }, [sourceId, targetCohortId, comparatorCohortId, pipeline, compareMutation, cohortProfileQuery, cohortSimilarityMutation, weights]);

  const handleRunStep = useCallback(
    (stepId: string) => {
      if (stepId === 'psm' && sourceId && targetCohortId && comparatorCohortId) {
        pipeline.markLoading('psm');
        const start = Date.now();
        psmMutation.mutate(
          { source_id: sourceId, target_cohort_id: targetCohortId, comparator_cohort_id: comparatorCohortId },
          {
            onSuccess: (data) => {
              pipeline.markCompleted('psm', {
                data,
                summary: `AUC ${data.model_metrics.auc.toFixed(2)} · ${data.matched_pairs.length} matched pairs`,
                executionTimeMs: Date.now() - start,
                completedAt: new Date(),
              });
            },
            onError: () => pipeline.markError('psm'),
          },
        );
        return;
      }

      if (stepId === 'landscape' && sourceId && targetCohortId) {
        pipeline.markLoading('landscape');
        const start = Date.now();

        // Determine which patient IDs to project
        let cohortPersonIds: number[] | undefined;
        if (pipeline.mode === 'compare') {
          // In compare mode, use PSM matched pairs if available
          const psmResult = pipeline.getStepResult('psm')?.data as PropensityMatchResult | undefined;
          if (psmResult) {
            cohortPersonIds = [
              ...psmResult.matched_pairs.map((p) => p.target_id),
              ...psmResult.matched_pairs.map((p) => p.comparator_id),
            ];
          }
        } else {
          // In expand mode, use similar patients from step 2
          const similarResult = pipeline.getStepResult('similar')?.data as SimilaritySearchResult | undefined;
          if (similarResult) {
            cohortPersonIds = similarResult.similar_patients
              .map((p) => p.person_id)
              .filter((id): id is number => id != null);
          }
        }

        landscapeMutation.mutate(
          { source_id: sourceId, cohort_person_ids: cohortPersonIds },
          {
            onSuccess: (data) => {
              pipeline.markCompleted('landscape', {
                data,
                summary: `${data.n_patients.toLocaleString()} patients projected · ${data.n_clusters} clusters`,
                executionTimeMs: Date.now() - start,
                completedAt: new Date(),
              });
            },
            onError: () => pipeline.markError('landscape'),
          },
        );
        return;
      }

      if (stepId === 'phenotypes' && sourceId && targetCohortId) {
        pipeline.markLoading('phenotypes');
        const start = Date.now();
        phenotypeMutation.mutate(
          { source_id: sourceId, cohort_definition_id: targetCohortId },
          {
            onSuccess: (data) => {
              pipeline.markCompleted('phenotypes', {
                data,
                summary: `${data.quality.k_used} clusters · silhouette ${data.quality.silhouette_score.toFixed(3)}`,
                executionTimeMs: Date.now() - start,
                completedAt: new Date(),
              });
            },
            onError: () => pipeline.markError('phenotypes'),
          },
        );
        return;
      }

      if (stepId === 'snf' && sourceId && targetCohortId) {
        pipeline.markLoading('snf');
        const start = Date.now();
        snfMutation.mutate(
          { source_id: sourceId, cohort_definition_id: targetCohortId },
          {
            onSuccess: (data) => {
              pipeline.markCompleted('snf', {
                data,
                summary: `${data.communities.length} communities · ${data.n_patients} patients · ${data.convergence.iterations} iterations`,
                executionTimeMs: Date.now() - start,
                completedAt: new Date(),
              });
            },
            onError: () => pipeline.markError('snf'),
          },
        );
        return;
      }
    },
    [sourceId, targetCohortId, comparatorCohortId, pipeline, psmMutation, landscapeMutation, phenotypeMutation, snfMutation],
  );

  // ── Step Content Renderer ─────────────────────────────────────────

  const renderStepContent = useCallback(
    (stepId: string): ReactNode => {
      const result = pipeline.getStepResult(stepId);
      const data = result?.data as CohortComparisonResult | undefined;

      switch (stepId) {
        // ── Expand mode steps ──────────────────────────────────────
        case 'centroid': {
          const profileData = result?.data as CohortProfileResult | undefined;
          if (!profileData) return null;
          return (
            <CentroidProfilePanel
              profile={profileData}
              onContinue={() => pipeline.expandStep('similar')}
            />
          );
        }

        case 'similar': {
          const searchResult = result?.data as SimilaritySearchResult | undefined;
          if (!searchResult) return null;
          return (
            <SimilarPatientsPanel
              result={searchResult}
              sourceId={sourceId ?? 0}
              onContinue={() => handleRunStep('landscape')}
            />
          );
        }

        // ── Compare mode steps ─────────────────────────────────────
        case 'profile':
          if (!data) return null;
          return (
            <ProfileComparisonPanel
              result={data}
              sourceName={getCohortName(targetCohortId)}
              targetName={getCohortName(comparatorCohortId)}
              onContinue={() => pipeline.expandStep('balance')}
            />
          );

        case 'balance':
          if (!data) return null;
          return (
            <CovariateBalancePanel
              result={data}
              covariates={data.covariates}
              distributionalRows={data.distributional_divergence}
              onRunPsm={() => handleRunStep('psm')}
              onContinue={() => handleRunStep('landscape')}
            />
          );

        case 'psm': {
          const psmData = result?.data as PropensityMatchResult | undefined;
          if (!psmData) return null;
          return (
            <PsmPanel
              result={psmData}
              onExportMatched={() => { /* TODO: export matched cohort */ }}
              onContinue={() => handleRunStep('landscape')}
            />
          );
        }

        case 'landscape': {
          const landscapeData = result?.data as LandscapeResult | undefined;
          if (!landscapeData) return null;
          return (
            <LandscapePanel
              result={landscapeData}
              onContinue={() => handleRunStep('phenotypes')}
            />
          );
        }

        case 'phenotypes': {
          const phenotypeData = result?.data as PhenotypeDiscoveryResult | undefined;
          if (!phenotypeData) return null;
          return (
            <PhenotypeDiscoveryPanel
              result={phenotypeData}
              onContinue={pipeline.mode === 'compare' ? () => handleRunStep('snf') : undefined}
            />
          );
        }

        case 'snf': {
          const snfData = result?.data as NetworkFusionResult | undefined;
          if (!snfData) return null;
          return <NetworkFusionPanel result={snfData} />;
        }

        default:
          return (
            <div className="flex min-h-[120px] items-center justify-center text-sm text-[#5A5650]">
              This step will be available in a future update.
            </div>
          );
      }
    },
    [pipeline, sourceId, targetCohortId, comparatorCohortId, getCohortName, handleRunStep],
  );

  // ── Render ────────────────────────────────────────────────────────

  // usePipeline returns steps alongside state+actions
  const steps = (pipeline as unknown as { steps: import('../types/pipeline').StepDefinition[] }).steps;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="page-title">Patient Similarity</h1>
            <p className="page-subtitle">
              Compare cohort profiles, find similar patients, and run propensity score matching across OMOP CDM sources
            </p>
          </div>
          <HelpButton helpKey="patient-similarity" />
        </div>
        <div className="flex items-center gap-2">
          <SimilarityModeToggle
            mode={similarityMode}
            onChange={setSimilarityMode}
          />
        </div>
      </div>

      {/* Toolbar */}
      <CohortSelectorBar
        mode={pipeline.mode}
        sourceId={sourceId}
        targetCohortId={targetCohortId}
        comparatorCohortId={comparatorCohortId}
        onModeChange={handleModeChange}
        onSourceChange={handleSourceChange}
        onTargetChange={handleTargetChange}
        onComparatorChange={handleComparatorChange}
        onCompare={handleCompare}
        onOpenSettings={() => setSettingsOpen(!settingsOpen)}
        isRunning={compareMutation.isPending || cohortSimilarityMutation.isPending}
      />

      {/* Analysis pipeline */}
      <AnalysisPipeline
        steps={steps}
        expandedSteps={pipeline.expandedSteps}
        getStepStatus={pipeline.getStepStatus}
        getStepResult={pipeline.getStepResult}
        onToggleStep={pipeline.toggleStep}
        onRunStep={handleRunStep}
        renderStepContent={renderStepContent}
      />

      {/* Drawers */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        weights={weights}
        onWeightsChange={setWeights}
        ageMin={ageMin}
        ageMax={ageMax}
        onAgeMinChange={setAgeMin}
        onAgeMaxChange={setAgeMax}
        gender={gender}
        onGenderChange={setGender}
        onApply={handleCompare}
      />

      <HeadToHeadDrawer
        open={h2hOpen}
        onClose={() => setH2hOpen(false)}
        personAId={h2hPersonA}
        personBId={h2hPersonB}
        sourceId={sourceId ?? 0}
      />
    </div>
  );
}
