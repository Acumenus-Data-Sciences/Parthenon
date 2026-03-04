import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompact, DOMAIN_COLORS, CHART, TOOLTIP_CLS } from "./chartUtils";

interface DomainTreemapProps {
  data: { name: string; size: number; color: string }[];
  onDomainClick?: (domain: string) => void;
}

// Custom content renderer for treemap cells
function TreemapContent(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  size: number;
  color: string;
  onDomainClick?: (domain: string) => void;
}) {
  const { x, y, width, height, name, size, color, onDomainClick } = props;

  if (width < 30 || height < 20) return null;

  const showCount = width > 60 && height > 40;

  return (
    <g
      onClick={() => onDomainClick?.(name.toLowerCase())}
      style={{ cursor: onDomainClick ? "pointer" : "default" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.75}
        stroke={CHART.border}
        strokeWidth={2}
        rx={4}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - (showCount ? 6 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#0E0E11"
        fontSize={width > 100 ? 13 : 10}
        fontWeight={600}
      >
        {name}
      </text>
      {showCount && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0E0E11"
          fontSize={10}
          fontFamily="'IBM Plex Mono', monospace"
          opacity={0.8}
        >
          {formatCompact(size)}
        </text>
      )}
    </g>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; size: number; color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={TOOLTIP_CLS}>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: d.color }}
        />
        <span className="text-xs text-[#F0EDE8]">{d.name}</span>
      </div>
      <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
        {d.size.toLocaleString()} records
      </p>
    </div>
  );
}

export function DomainTreemap({ data, onDomainClick }: DomainTreemapProps) {
  if (!data.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke={CHART.border}
          content={<TreemapContent onDomainClick={onDomainClick} name="" size={0} color="" x={0} y={0} width={0} height={0} />}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>

      {/* Summary table for precision */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        {data
          .sort((a, b) => b.size - a.size)
          .map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-xs text-[#C5C0B8]">{d.name}</span>
              </div>
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
                {formatCompact(d.size)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

export { DOMAIN_COLORS };
