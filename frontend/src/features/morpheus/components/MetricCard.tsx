import { type MouseEventHandler } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  onClick?: MouseEventHandler;
}

export default function MetricCard({ label, value, color = '#2DD4BF', subtext, onClick }: MetricCardProps) {
  return (
    <div
      className={`rounded-xl border border-border-default bg-surface-darkest/70 p-4 flex flex-col gap-1 transition-colors ${onClick ? 'cursor-pointer hover:bg-surface-overlay' : ''}`}
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent); } : undefined}
    >
      <span className="text-2xl font-bold text-text-primary">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-text-ghost">{label}</span>
      {subtext && <span className="text-[10px] text-text-ghost">{subtext}</span>}
    </div>
  );
}
