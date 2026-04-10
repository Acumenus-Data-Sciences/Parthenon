import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabValuesTable } from '../LabValuesTable';

const baseValues = [
  { date: '2025-11-04', value: 11.8, status: 'low' as const },
  { date: '2025-08-02', value: 12.4, status: 'normal' as const },
  { date: '2025-05-10', value: 13.1, status: 'normal' as const },
];

describe('LabValuesTable', () => {
  it('renders headers', () => {
    render(<LabValuesTable values={baseValues} unitName="g/dL" range={null} />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders one row per value', () => {
    render(<LabValuesTable values={baseValues} unitName="g/dL" range={null} />);
    expect(screen.getAllByRole('row')).toHaveLength(4); // header + 3 values
  });

  it('renders status text per row', () => {
    render(<LabValuesTable values={baseValues} unitName="g/dL" range={null} />);
    expect(screen.getAllByText('Normal')).toHaveLength(2);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders range when present', () => {
    render(
      <LabValuesTable
        values={baseValues}
        unitName="g/dL"
        range={{ low: 12.0, high: 15.5, source: 'curated', sourceLabel: 'LOINC (F, 18+)' }}
      />
    );
    // The en-dash between low and high
    const rangeCells = screen.getAllByText(/12.*15\.5.*g\/dL/);
    expect(rangeCells.length).toBeGreaterThan(0);
  });
});
