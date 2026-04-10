import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PatientSimilarityWorkspace from '../PatientSimilarityWorkspace';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PatientSimilarityWorkspace />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PatientSimilarityWorkspace', () => {
  it('renders CohortSelectorBar with mode toggle', () => {
    renderPage();
    expect(screen.getByText('Compare Cohorts')).toBeInTheDocument();
    expect(screen.getByText('Expand Cohort')).toBeInTheDocument();
  });

  it('renders pipeline steps in compare mode', () => {
    renderPage();
    expect(screen.getByText('Profile Comparison')).toBeInTheDocument();
    expect(screen.getByText('Covariate Balance')).toBeInTheDocument();
    expect(screen.getByText('Propensity Score Matching')).toBeInTheDocument();
    expect(screen.getByText('UMAP Landscape')).toBeInTheDocument();
  });

  it('renders Compare button disabled when no cohorts selected', () => {
    renderPage();
    expect(screen.getByText('Compare')).toBeDisabled();
  });
});
