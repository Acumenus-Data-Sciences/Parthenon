import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CohortSelectorBar } from '../CohortSelectorBar';

vi.mock('@/features/cohort-definitions/hooks/useCohortDefinitions', () => ({
  useCohortDefinitions: () => ({
    data: {
      items: [
        { id: 10, name: 'Hypertension Cohort' },
        { id: 20, name: 'Diabetes Cohort' },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock('@/features/data-sources/hooks/useSources', () => ({
  useSources: () => ({
    data: [{ id: 1, source_name: 'Synthetic OMOP' }],
    isLoading: false,
  }),
}));

vi.mock('../GenerationStatusBanner', () => ({
  GenerationStatusBanner: () => null,
}));

vi.mock('../../hooks/usePatientSimilarity', () => ({
  useCohortProfile: () => ({ data: undefined, isLoading: false }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('CohortSelectorBar', () => {
  it('renders mode toggle with Compare Cohorts active by default', () => {
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={null}
        comparatorCohortId={null}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Compare Cohorts')).toBeInTheDocument();
    expect(screen.getByText('Expand Cohort')).toBeInTheDocument();
  });

  it('renders Compare button in compare mode', () => {
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={10}
        comparatorCohortId={20}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Compare')).toBeInTheDocument();
  });

  it('renders Find Similar button in expand mode', () => {
    renderWithProviders(
      <CohortSelectorBar
        mode="expand"
        sourceId={1}
        targetCohortId={10}
        comparatorCohortId={null}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Find Similar')).toBeInTheDocument();
  });

  it('calls onModeChange when Expand Cohort clicked', () => {
    const onModeChange = vi.fn();
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={null}
        comparatorCohortId={null}
        onModeChange={onModeChange}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Expand Cohort'));
    expect(onModeChange).toHaveBeenCalledWith('expand');
  });

  it('calls onOpenSettings when gear button clicked', () => {
    const onOpenSettings = vi.fn();
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={null}
        comparatorCohortId={null}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.click(screen.getByTitle('Analysis settings'));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('disables Compare when cohorts not selected', () => {
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={null}
        comparatorCohortId={null}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Compare')).toBeDisabled();
  });
});
