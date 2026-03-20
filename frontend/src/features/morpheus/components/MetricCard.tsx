interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}

export default function MetricCard({ label, value, color = '#2DD4BF', subtext }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] p-4 flex flex-col gap-1"
         style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      <span className="text-2xl font-bold text-gray-100">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
      {subtext && <span className="text-[10px] text-gray-600">{subtext}</span>}
    </div>
  );
}
