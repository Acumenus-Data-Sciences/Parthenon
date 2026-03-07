interface SccsEra {
  era_name: string;
  era_type: "pre-exposure" | "exposure" | "post-exposure" | "control";
  start_day: number;
  end_day: number;
  event_count: number;
  person_days: number;
  irr?: number;
  ci_lower?: number;
  ci_upper?: number;
}

interface SccsTimelineProps {
  eras: SccsEra[];
  exposureName?: string;
}

const ERA_COLORS: Record<string, string> = {
  "pre-exposure": "#8A857D",
  exposure: "#2DD4BF",
  "post-exposure": "#C9A227",
  control: "#323238",
};

export function SccsTimeline({ eras, exposureName }: SccsTimelineProps) {
  if (eras.length === 0) return null;

  const width = 800;
  const height = 220;
  const padding = { top: 50, right: 30, bottom: 50, left: 30 };
  const plotW = width - padding.left - padding.right;
  const barArea = height - padding.top - padding.bottom;

  const allDays = eras.flatMap((e) => [e.start_day, e.end_day]);
  const minDay = Math.min(...allDays);
  const maxDay = Math.max(...allDays);
  const dayRange = maxDay - minDay || 1;

  const maxRate = Math.max(
    ...eras.map((e) => (e.person_days > 0 ? e.event_count / e.person_days : 0)),
    0.001,
  );

  const toX = (day: number) =>
    padding.left + ((day - minDay) / dayRange) * plotW;
  const toH = (events: number, personDays: number) => {
    const rate = personDays > 0 ? events / personDays : 0;
    return (rate / maxRate) * barArea * 0.8;
  };

  // Day axis ticks
  const tickStep = Math.max(Math.round(dayRange / 8), 1);
  const dayTicks: number[] = [];
  for (let d = minDay; d <= maxDay; d += tickStep) {
    dayTicks.push(d);
  }
  if (dayTicks[dayTicks.length - 1] !== maxDay) dayTicks.push(maxDay);

  const baseY = padding.top + barArea;

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-[#F0EDE8]"
        role="img"
        aria-label={`SCCS timeline for ${exposureName ?? "exposure"}`}
      >
        <rect width={width} height={height} fill="#151518" rx={8} />

        {/* Title */}
        {exposureName && (
          <text
            x={width / 2}
            y={20}
            textAnchor="middle"
            fill="#8A857D"
            fontSize={11}
            fontWeight={600}
          >
            {exposureName} — Risk Window Timeline
          </text>
        )}

        {/* Day axis */}
        <line
          x1={padding.left}
          y1={baseY}
          x2={padding.left + plotW}
          y2={baseY}
          stroke="#323238"
          strokeWidth={1}
        />
        {dayTicks.map((d) => (
          <g key={d}>
            <line
              x1={toX(d)}
              y1={baseY}
              x2={toX(d)}
              y2={baseY + 5}
              stroke="#5A5650"
              strokeWidth={1}
            />
            <text
              x={toX(d)}
              y={baseY + 18}
              textAnchor="middle"
              fill="#5A5650"
              fontSize={9}
            >
              {d}
            </text>
          </g>
        ))}
        <text
          x={padding.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="#8A857D"
          fontSize={10}
        >
          Days Relative to Exposure Start
        </text>

        {/* Era blocks */}
        {eras.map((era, i) => {
          const x1 = toX(era.start_day);
          const x2 = toX(era.end_day);
          const blockW = Math.max(x2 - x1, 2);
          const blockH = Math.max(toH(era.event_count, era.person_days), 8);
          const color = ERA_COLORS[era.era_type] ?? "#323238";

          return (
            <g key={i}>
              {/* Block */}
              <rect
                x={x1}
                y={baseY - blockH}
                width={blockW}
                height={blockH}
                fill={color}
                opacity={0.6}
                stroke={color}
                strokeWidth={1}
                rx={2}
              >
                <title>
                  {era.era_name}: {era.event_count} events / {era.person_days.toLocaleString()} person-days
                  {era.irr != null ? ` (IRR ${era.irr.toFixed(2)})` : ""}
                </title>
              </rect>

              {/* Label inside block */}
              {blockW > 50 && (
                <>
                  <text
                    x={x1 + blockW / 2}
                    y={baseY - blockH + 14}
                    textAnchor="middle"
                    fill="#F0EDE8"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {era.era_name}
                  </text>
                  <text
                    x={x1 + blockW / 2}
                    y={baseY - blockH + 26}
                    textAnchor="middle"
                    fill="#C5C0B8"
                    fontSize={8}
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {era.event_count} events
                  </text>
                </>
              )}

              {/* IRR annotation above exposure eras */}
              {era.irr != null && era.era_type === "exposure" && (
                <g>
                  <text
                    x={x1 + blockW / 2}
                    y={baseY - blockH - 10}
                    textAnchor="middle"
                    fill="#2DD4BF"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    IRR {era.irr.toFixed(2)}
                  </text>
                  {era.ci_lower != null && era.ci_upper != null && (
                    <text
                      x={x1 + blockW / 2}
                      y={baseY - blockH - 22}
                      textAnchor="middle"
                      fill="#8A857D"
                      fontSize={8}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      ({era.ci_lower.toFixed(2)}-{era.ci_upper.toFixed(2)})
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${height - 38})`}>
          {(["pre-exposure", "exposure", "post-exposure", "control"] as const).map((type, i) => (
            <g key={type} transform={`translate(${i * 150}, 0)`}>
              <rect x={0} y={0} width={10} height={10} rx={2} fill={ERA_COLORS[type]} opacity={0.6} />
              <text x={14} y={9} fill="#8A857D" fontSize={9}>
                {type.replace("-", " ").replace(/^\w/, (c) => c.toUpperCase())}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
