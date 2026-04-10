import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { LabTrendChart } from '../LabTrendChart';

// Recharts ResponsiveContainer needs non-zero dimensions in jsdom
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 200 });
});

const sampleValues = [
  { date: '2025-05-10', value: 13.1, status: 'normal' as const },
  { date: '2025-08-02', value: 12.4, status: 'normal' as const },
  { date: '2025-11-04', value: 11.8, status: 'low' as const },
];

describe('LabTrendChart', () => {
  it('renders reference label footnote when range is provided', () => {
    const { container } = render(
      <LabTrendChart
        conceptName="Hemoglobin"
        unitName="g/dL"
        values={sampleValues}
        range={{ low: 12.0, high: 15.5, source: 'curated', sourceLabel: 'LOINC (F, 18+)' }}
      />
    );
    expect(container.textContent).toContain('Reference:');
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('15.5');
  });

  it('does not render reference footnote when range is null', () => {
    const { container } = render(
      <LabTrendChart conceptName="Hemoglobin" unitName="g/dL" values={sampleValues} range={null} />
    );
    expect(container.textContent).not.toContain('Reference:');
  });

  it('renders the source label footnote when range is present', () => {
    const { container } = render(
      <LabTrendChart
        conceptName="Hemoglobin"
        unitName="g/dL"
        values={sampleValues}
        range={{ low: 12.0, high: 15.5, source: 'curated', sourceLabel: 'LOINC (F, 18+)' }}
      />
    );
    expect(container.textContent).toContain('LOINC (F, 18+)');
  });

  it('does not render footnote when range is null', () => {
    const { container } = render(
      <LabTrendChart conceptName="Hemoglobin" unitName="g/dL" values={sampleValues} range={null} />
    );
    expect(container.textContent).not.toContain('Reference:');
  });

  it('shows empty state for no numeric values', () => {
    const { container } = render(
      <LabTrendChart conceptName="Test" unitName="x" values={[]} range={null} />
    );
    expect(container.textContent).toContain('No numeric values');
  });
});
