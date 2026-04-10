import { useCallback, useState } from 'react';
import {
  COMPARE_STEPS,
  EXPAND_STEPS,
  type PipelineActions,
  type PipelineMode,
  type PipelineState,
  type StepResult,
  type StepStatus,
} from '../types/pipeline';

const initialState = (): PipelineState => ({
  mode: 'compare',
  expandedSteps: new Set<string>(),
  completedSteps: new Map<string, StepResult>(),
  stepStatuses: new Map<string, StepStatus>(),
});

export function usePipeline(): PipelineState & PipelineActions {
  const [state, setState] = useState<PipelineState>(initialState);

  const setMode = useCallback((mode: PipelineMode) => {
    setState({
      ...initialState(),
      mode,
    });
  }, []);

  const toggleStep = useCallback((stepId: string) => {
    setState((prev) => {
      const next = new Set(prev.expandedSteps);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return { ...prev, expandedSteps: next };
    });
  }, []);

  const expandStep = useCallback((stepId: string) => {
    setState((prev) => {
      const next = new Set(prev.expandedSteps);
      next.add(stepId);
      return { ...prev, expandedSteps: next };
    });
  }, []);

  const collapseStep = useCallback((stepId: string) => {
    setState((prev) => {
      const next = new Set(prev.expandedSteps);
      next.delete(stepId);
      return { ...prev, expandedSteps: next };
    });
  }, []);

  const markCompleted = useCallback((stepId: string, result: StepResult) => {
    setState((prev) => {
      const completedSteps = new Map(prev.completedSteps);
      completedSteps.set(stepId, result);
      const stepStatuses = new Map(prev.stepStatuses);
      stepStatuses.set(stepId, 'completed');
      const expandedSteps = new Set(prev.expandedSteps);
      expandedSteps.add(stepId);
      return { ...prev, completedSteps, stepStatuses, expandedSteps };
    });
  }, []);

  const markLoading = useCallback((stepId: string) => {
    setState((prev) => {
      const stepStatuses = new Map(prev.stepStatuses);
      stepStatuses.set(stepId, 'loading');
      return { ...prev, stepStatuses };
    });
  }, []);

  const markError = useCallback((stepId: string) => {
    setState((prev) => {
      const stepStatuses = new Map(prev.stepStatuses);
      stepStatuses.set(stepId, 'error');
      return { ...prev, stepStatuses };
    });
  }, []);

  const resetPipeline = useCallback(() => {
    setState((prev) => ({
      ...initialState(),
      mode: prev.mode,
    }));
  }, []);

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => state.stepStatuses.get(stepId) ?? 'future',
    [state.stepStatuses],
  );

  const getStepResult = useCallback(
    (stepId: string): StepResult | undefined => state.completedSteps.get(stepId),
    [state.completedSteps],
  );

  const steps = state.mode === 'compare' ? COMPARE_STEPS : EXPAND_STEPS;

  return {
    ...state,
    steps,
    setMode,
    toggleStep,
    expandStep,
    collapseStep,
    markCompleted,
    markLoading,
    markError,
    resetPipeline,
    getStepStatus,
    getStepResult,
  } as PipelineState & PipelineActions & { steps: typeof steps };
}
