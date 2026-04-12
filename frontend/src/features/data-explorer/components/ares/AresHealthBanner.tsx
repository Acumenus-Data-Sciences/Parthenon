interface AresHealthBannerProps {
  sourceCount: number;
  avgDqScore: number | null;
  unmappedCodes: number;
  annotationCount: number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl font-bold text-[#F0EDE8]">{value}</span>
      <span className="text-xs uppercase tracking-wider text-[#8A857D]">{label}</span>
    </div>
  );
}

export function AresHealthBanner({
  sourceCount,
  avgDqScore,
  unmappedCodes,
  annotationCount,
}: AresHealthBannerProps) {
  return (
    <div className="rounded-xl border border-[#252530] bg-gradient-to-r from-[#151518] via-[#1a1a22] to-[#151518] p-6">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Sources" value={String(sourceCount)} />
        <Stat label="Avg DQ Score" value={avgDqScore != null ? `${avgDqScore}%` : "--"} />
        <Stat label="Unmapped Codes" value={unmappedCodes.toLocaleString()} />
        <Stat label="Annotations" value={String(annotationCount)} />
      </div>
    </div>
  );
}
