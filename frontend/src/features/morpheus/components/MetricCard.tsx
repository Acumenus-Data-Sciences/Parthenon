interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}

export default function MetricCard({ label, value, color = '#2DD4BF', subtext }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 flex flex-col gap-1"
         style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      <span className="text-2xl font-bold text-zinc-100">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      {subtext && <span className="text-[10px] text-zinc-600">{subtext}</span>}
    </div>
  );
}
