import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabStatusDot } from '../LabStatusDot';

describe('LabStatusDot', () => {
  it('renders a blue dot for low status', () => {
    const { container } = render(
      <svg><LabStatusDot cx={10} cy={10} payload={{ status: 'low' }} /></svg>
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#3B82F6');
    expect(circle?.getAttribute('r')).toBe('4');
  });

  it('renders a zinc dot for normal status', () => {
    const { container } = render(
      <svg><LabStatusDot cx={10} cy={10} payload={{ status: 'normal' }} /></svg>
    );
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('#A1A1AA');
  });

  it('renders crimson for high status', () => {
    const { container } = render(
      <svg><LabStatusDot cx={10} cy={10} payload={{ status: 'high' }} /></svg>
    );
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('#9B1B30');
  });

  it('renders crimson+gold ring for critical', () => {
    const { container } = render(
      <svg><LabStatusDot cx={10} cy={10} payload={{ status: 'critical' }} /></svg>
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#9B1B30');
    expect(circle?.getAttribute('stroke')).toBe('#C9A227');
  });

  it('renders hollow for unknown', () => {
    const { container } = render(
      <svg><LabStatusDot cx={10} cy={10} payload={{ status: 'unknown' }} /></svg>
    );
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('transparent');
  });

  it('returns null when cx/cy are undefined', () => {
    const { container } = render(<svg><LabStatusDot /></svg>);
    expect(container.querySelector('circle')).toBeNull();
  });
});
