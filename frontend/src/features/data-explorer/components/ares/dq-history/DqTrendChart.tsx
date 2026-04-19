import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";
import { AnnotationMarker } from "../annotations/AnnotationMarker";
import type { DqTrendPoint } from "../../../types/ares";

const SOURCE_COLORS = ["var(--success)", "var(--accent)", "var(--critical)", "#7c8aed", "#59c990", "#f0a8d0", "#87ceeb"];

interface OverlaySource {
  source_id: number;
  source_name: string;
  trends: Array<{
    release_name: string;
    created_at: string;
    pass_rate: number;
  }>;
}

interface DqTrendChartProps {
  data: DqTrendPoint[];
  sourceId?: number | null;
  onReleaseClick?: (releaseId: number) => void;
  overlayData?: OverlaySource[];
}

export default function DqTrendChart({ data, sourceId, onReleaseClick, overlayData }: DqTrendChartProps) {
  const { t } = useTranslation("app");
  // Overlay mode: multiple sources on same timeline
  if (overlayData && overlayData.length > 0) {
    return <OverlayChart overlayData={overlayData} />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-text-ghost">
        {t("dataExplorer.ares.dqHistory.messages.noTrendData")}
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: d.release_name,
  }));

  // Collect x-values (release names) for annotation markers
  const xValues = data.map((d) => d.release_name);

  return (
    <div>
      {/* Annotation markers above the chart */}
      {sourceId && (
        <div className="mb-1">
          <AnnotationMarker sourceId={sourceId} chartType="dq_trend" xValues={xValues} />
        </div>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            onClick={(e) => {
              const event = e as Record<string, unknown>;
              const activePayload = event?.activePayload as Array<{ payload: Record<string, unknown> }> | undefined;
              if (activePayload?.[0]?.payload && onReleaseClick) {
                onReleaseClick(activePayload[0].payload.release_id as number);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-accent)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--surface-highlight)" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--surface-highlight)" }}
              tickFormatter={(v: number) => t("dataExplorer.ares.networkOverview.percent", { value: formatNumber(v) })}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-overlay)",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
              formatter={((value: number | string) => [
                t("dataExplorer.ares.networkOverview.percent", {
                  value: formatNumber(Number(value), { maximumFractionDigits: 1 }),
                }),
                t("dataExplorer.ares.dqHistory.passRate"),
              ]) as never}
            />
            {/* Good zone: >90% -- green */}
            <ReferenceArea y1={90} y2={100} fill="var(--success)" fillOpacity={0.05} ifOverflow="extendDomain" />

            {/* Warning zone: 80-90% -- amber */}
            <ReferenceArea y1={80} y2={90} fill="var(--accent)" fillOpacity={0.05} ifOverflow="extendDomain" />

            {/* Danger zone: <80% -- red */}
            <ReferenceArea y1={0} y2={80} fill="var(--primary)" fillOpacity={0.05} ifOverflow="extendDomain" />

            <ReferenceLine y={80} stroke="var(--accent)" strokeDasharray="5 5" />
            <Line
              type="monotone"
              dataKey="pass_rate"
              stroke="var(--success)"
              strokeWidth={2}
              dot={{ fill: "var(--success)", r: 5, cursor: "pointer" }}
              activeDot={{ r: 7, fill: "var(--success)" }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-center text-[10px] text-text-ghost">
          {t("dataExplorer.ares.dqHistory.messages.trendHelp")}
        </p>
      </div>
    </div>
  );
}

function OverlayChart({ overlayData }: { overlayData: OverlaySource[] }) {
  const { t } = useTranslation("app");
  // Merge all sources onto a unified timeline keyed by created_at
  const timelineMap = new Map<string, Record<string, unknown>>();

  for (const source of overlayData) {
    for (const trend of source.trends) {
      const key = trend.created_at.substring(0, 10); // date only
      const existing = timelineMap.get(key) ?? { date: key };
      existing[`source_${source.source_id}`] = trend.pass_rate;
      timelineMap.set(key, existing);
    }
  }

  const chartData = Array.from(timelineMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-accent)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--surface-highlight)" }}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--surface-highlight)" }}
            tickFormatter={(v: number) => t("dataExplorer.ares.networkOverview.percent", { value: formatNumber(v) })}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-overlay)",
              border: "1px solid #333",
              borderRadius: "8px",
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
          <ReferenceArea y1={90} y2={100} fill="var(--success)" fillOpacity={0.05} ifOverflow="extendDomain" />
          <ReferenceArea y1={80} y2={90} fill="var(--accent)" fillOpacity={0.05} ifOverflow="extendDomain" />
          <ReferenceArea y1={0} y2={80} fill="var(--primary)" fillOpacity={0.05} ifOverflow="extendDomain" />
          <ReferenceLine y={80} stroke="var(--accent)" strokeDasharray="5 5" />

          {overlayData.map((source, i) => (
            <Line
              key={source.source_id}
              type="monotone"
              dataKey={`source_${source.source_id}`}
              name={source.source_name}
              stroke={SOURCE_COLORS[i % SOURCE_COLORS.length]}
              strokeWidth={2}
              dot={{ fill: SOURCE_COLORS[i % SOURCE_COLORS.length], r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[10px] text-text-ghost">
        {t("dataExplorer.ares.dqHistory.messages.overlayHelp")}
      </p>
    </div>
  );
}
