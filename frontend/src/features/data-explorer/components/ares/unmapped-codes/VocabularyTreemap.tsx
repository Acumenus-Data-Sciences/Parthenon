import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface TreemapItem {
  name: string;
  value: number;
  code_count: number;
}

interface VocabularyTreemapProps {
  data: TreemapItem[];
}

const COLORS = [
  "#2DD4BF", "#C9A227", "#9B1B30", "#7c8aed", "#e85d75",
  "#4ade80", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomContent(props: any) {
  const { x, y, width, height, index, name, value } = props;

  if (width < 40 || height < 30) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={COLORS[index % COLORS.length]}
        fillOpacity={0.85}
        stroke="#0E0E11"
        strokeWidth={2}
        rx={4}
      />
      {width > 60 && height > 40 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#fff"
            fontSize={11}
            fontWeight={600}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize={10}
          >
            {Number(value).toLocaleString()} records
          </text>
        </>
      )}
    </g>
  );
}

export default function VocabularyTreemap({ data }: VocabularyTreemapProps) {
  if (data.length === 0) return null;

  const treemapData = data.map((d) => ({
    name: d.name,
    size: d.value,
    value: d.value,
    code_count: d.code_count,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treemapData}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#0E0E11"
          content={<CustomContent />}
        >
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a22",
              border: "1px solid #333",
              borderRadius: "8px",
              color: "#ccc",
              fontSize: 12,
            }}
            formatter={((value: unknown, _name: string, entry: { payload?: { code_count?: number; name?: string } }) => {
              const item = entry?.payload;
              return [
                `${Number(value).toLocaleString()} records (${item?.code_count ?? 0} codes)`,
                item?.name ?? "Vocabulary",
              ];
            }) as never}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
