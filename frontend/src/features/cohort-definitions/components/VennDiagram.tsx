import type { CohortOverlapPair } from "../types/cohortExpression";

interface VennDiagramProps {
  pair: CohortOverlapPair;
  labelA?: string;
  labelB?: string;
}

/**
 * SVG-based two-set Venn diagram for cohort overlap visualization.
 * Circle sizes are proportional to cohort counts; overlap width reflects Jaccard index.
 */
export function VennDiagram({
  pair,
  labelA = `Cohort ${pair.cohort_id_a}`,
  labelB = `Cohort ${pair.cohort_id_b}`,
}: VennDiagramProps) {
  const width = 400;
  const height = 240;
  const maxR = 80;
  const minR = 30;

  const maxCount = Math.max(pair.count_a, pair.count_b, 1);
  const rA = minR + ((pair.count_a / maxCount) * (maxR - minR));
  const rB = minR + ((pair.count_b / maxCount) * (maxR - minR));

  // Distance between circle centers — closer = more overlap
  // jaccard_index ranges 0-1, invert for distance
  const maxDist = rA + rB + 10; // no overlap
  const minDist = Math.abs(rA - rB); // full overlap (smaller inside larger)
  const overlap = pair.jaccard_index;
  const dist = maxDist - overlap * (maxDist - minDist);

  const cx = width / 2;
  const cy = height / 2 + 10;
  const cxA = cx - dist / 2;
  const cxB = cx + dist / 2;

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md">
      <defs>
        <clipPath id={`clip-a-${pair.cohort_id_a}`}>
          <circle cx={cxA} cy={cy} r={rA} />
        </clipPath>
        <clipPath id={`clip-b-${pair.cohort_id_b}`}>
          <circle cx={cxB} cy={cy} r={rB} />
        </clipPath>
      </defs>

      {/* Circle A */}
      <circle
        cx={cxA}
        cy={cy}
        r={rA}
        fill="#2DD4BF"
        fillOpacity={0.2}
        stroke="#2DD4BF"
        strokeWidth={1.5}
      />

      {/* Circle B */}
      <circle
        cx={cxB}
        cy={cy}
        r={rB}
        fill="#818CF8"
        fillOpacity={0.2}
        stroke="#818CF8"
        strokeWidth={1.5}
      />

      {/* Overlap region — draw circle B clipped to circle A */}
      {pair.overlap_count > 0 && (
        <circle
          cx={cxB}
          cy={cy}
          r={rB}
          fill="#C9A227"
          fillOpacity={0.35}
          clipPath={`url(#clip-a-${pair.cohort_id_a})`}
        />
      )}

      {/* Labels — cohort names above circles */}
      <text
        x={cxA}
        y={cy - rA - 12}
        textAnchor="middle"
        className="fill-[#F0EDE8] text-[11px] font-medium"
      >
        {labelA}
      </text>
      <text
        x={cxB}
        y={cy - rB - 12}
        textAnchor="middle"
        className="fill-[#F0EDE8] text-[11px] font-medium"
      >
        {labelB}
      </text>

      {/* Counts — only A, overlap, only B */}
      <text
        x={cxA - rA * 0.4}
        y={cy + 4}
        textAnchor="middle"
        className="fill-[#2DD4BF] text-[10px] font-['IBM_Plex_Mono',monospace]"
      >
        {fmt(pair.only_a)}
      </text>
      {pair.overlap_count > 0 && (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="fill-[#C9A227] text-[11px] font-semibold font-['IBM_Plex_Mono',monospace]"
        >
          {fmt(pair.overlap_count)}
        </text>
      )}
      <text
        x={cxB + rB * 0.4}
        y={cy + 4}
        textAnchor="middle"
        className="fill-[#818CF8] text-[10px] font-['IBM_Plex_Mono',monospace]"
      >
        {fmt(pair.only_b)}
      </text>

      {/* Jaccard index */}
      <text
        x={cx}
        y={height - 8}
        textAnchor="middle"
        className="fill-[#8A857D] text-[9px]"
      >
        Jaccard Index: {pair.jaccard_index.toFixed(3)}
      </text>
    </svg>
  );
}
