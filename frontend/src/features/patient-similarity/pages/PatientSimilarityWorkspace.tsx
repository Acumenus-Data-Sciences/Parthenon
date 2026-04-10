import { type ReactNode, useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usePipeline } from '../hooks/usePipeline';
import { useCompareCohorts, usePropensityMatch } from '../hooks/usePatientSimilarity';
import { projectPatientLandscape } from '../api/patientSimilarityApi';
import { useCohortDefinitions } from '@/features/cohort-definitions/hooks/useCohortDefinitions';
import { useSourceStore } from '@/stores/sourceStore';
import { CohortSelectorBar } from '../components/CohortSelectorBar';
import { AnalysisPipeline } from '../components/AnalysisPipeline';
import { ProfileComparisonPanel } from '../components/ProfileComparisonPanel';
import { CovariateBalancePanel } from '../components/CovariateBalancePanel';
import { PsmPanel } from '../components/PsmPanel';
import { LandscapePanel } from '../components/LandscapePanel';
import type {
  CohortComparisonResult,
  CovariateBalanceRow,
  PropensityMatchResult,
  LandscapeResult,
  LandscapeParams,
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

  const [sourceId, setSourceId] = useState<number | null>(activeSourceId);
  const [targetCohortId, setTargetCohortId] = useState<number | null>(null);
  const [comparatorCohortId, setComparatorCohortId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pipeline = usePipeline();
  const compareMutation = useCompareCohorts();
  const psmMutation = usePropensityMatch();
  const landscapeMutation = useMutation({
    mutationFn: (params: LandscapeParams) => projectPatientLandscape(params),
  });

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
      setSourceId(id);
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

    if (pipeline.mode === 'compare' && comparatorCohortId == null) return;

    pipeline.resetPipeline();
    pipeline.markLoading('profile');

    const startMs = performance.now();

    compareMutation.mutate(
      {
        source_cohort_id: targetCohortId,
        target_cohort_id: pipeline.mode === 'compare' ? comparatorCohortId! : targetCohortId,
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

          // Balance step uses the same response for now (covariates may be empty)
          const covariates = (data as CohortComparisonResult & { covariates?: CovariateBalanceRow[] }).covariates ?? [];
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
  }, [sourceId, targetCohortId, comparatorCohortId, pipeline, compareMutation]);

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
        // Collect person IDs from PSM matched pairs if available, otherwise use cohort IDs
        const psmResult = pipeline.getStepResult('psm')?.data as PropensityMatchResult | undefined;
        const cohortPersonIds = psmResult
          ? [...psmResult.matched_pairs.map((p) => p.target_id), ...psmResult.matched_pairs.map((p) => p.comparator_id)]
          : undefined;
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
    },
    [sourceId, targetCohortId, comparatorCohortId, pipeline, psmMutation, landscapeMutation],
  );

  // ── Step Content Renderer ─────────────────────────────────────────

  const renderStepContent = useCallback(
    (stepId: string): ReactNode => {
      const result = pipeline.getStepResult(stepId);
      const data = result?.data as CohortComparisonResult | undefined;

      switch (stepId) {
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
              covariates={(data as CohortComparisonResult & { covariates?: CovariateBalanceRow[] }).covariates}
              onRunPsm={() => handleRunStep('psm')}
              onContinue={() => pipeline.expandStep('landscape')}
            />
          );

        case 'psm': {
          const psmData = result?.data as PropensityMatchResult | undefined;
          if (!psmData) return null;
          return (
            <PsmPanel
              result={psmData}
              onExportMatched={() => { /* TODO: export matched cohort */ }}
              onContinue={() => pipeline.expandStep('landscape')}
            />
          );
        }

        case 'landscape': {
          const landscapeData = result?.data as LandscapeResult | undefined;
          if (!landscapeData) return null;
          return (
            <LandscapePanel
              result={landscapeData}
              onContinue={() => pipeline.expandStep('phenotypes')}
            />
          );
        }

        default:
          return (
            <div className="flex min-h-[120px] items-center justify-center text-sm text-[#5A5650]">
              This step will be available in a future update.
            </div>
          );
      }
    },
    [pipeline, targetCohortId, comparatorCohortId, getCohortName, handleRunStep],
  );

  // ── Render ────────────────────────────────────────────────────────

  // usePipeline returns steps alongside state+actions
  const steps = (pipeline as unknown as { steps: import('../types/pipeline').StepDefinition[] }).steps;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0E0E11]">
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
        isRunning={compareMutation.isPending}
      />

      <div className="flex-1 overflow-y-auto">
        <AnalysisPipeline
          steps={steps}
          expandedSteps={pipeline.expandedSteps}
          getStepStatus={pipeline.getStepStatus}
          getStepResult={pipeline.getStepResult}
          onToggleStep={pipeline.toggleStep}
          onRunStep={handleRunStep}
          renderStepContent={renderStepContent}
        />
      </div>
    </div>
  );
}
