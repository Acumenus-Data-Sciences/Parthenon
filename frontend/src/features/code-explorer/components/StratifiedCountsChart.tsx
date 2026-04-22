import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { StratifiedCount } from "../types";
import { getGenderLabel } from "../lib/i18n";

type Mode = "node" | "descendant";
type GroupBy = "gender" | "age_decile";

export function StratifiedCountsChart({
  data,
  mode,
  groupBy,
}: {
  data: StratifiedCount[];
  mode: Mode;
  groupBy: GroupBy;
}) {
  const { t } = useTranslation("app");
  const series = useMemo(() => {
    const groups = new Map<string, Map<number, number>>();
    for (const row of data) {
      const groupKey =
        groupBy === "gender"
          ? getGenderLabel(t, row.gender_concept_id)
          : labelForDecile(row.age_decile);
      const count = mode === "node" ? row.n_node : row.n_descendant;
      if (!groups.has(groupKey)) groups.set(groupKey, new Map());
      const inner = groups.get(groupKey)!;
      inner.set(row.year, (inner.get(row.year) ?? 0) + count);
    }

    const years = Array.from(new Set(data.map((r) => r.year))).sort((a, b) => a - b);
    return years.map((year) => {
      const entry: Record<string, number | string> = { year };
      for (const [groupKey, yearMap] of groups) {
        entry[groupKey] = yearMap.get(year) ?? 0;
      }
      return entry;
    });
  }, [data, mode, groupBy, t]);

  const groupKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of series) {
      for (const k of Object.keys(entry)) {
        if (k !== "year") keys.add(k);
      }
    }
    return Array.from(keys);
  }, [series]);

  if (series.length === 0) {
    return <div className="p-6 text-center text-slate-400">{t("codeExplorer.chart.noData")}</div>;
  }

  const palette = [
    "#2DD4BF", "#9B1B30", "#C9A227", "#60A5FA", "#A78BFA",
    "#F472B6", "#FBBF24", "#34D399", "#F87171", "#818CF8",
  ];

  return (
    <div style={{ width: "100%", height: 400 }}>
      <ResponsiveContainer>
        <BarChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="year" stroke="#94A3B8" />
          <YAxis stroke="#94A3B8" />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={((value: number) => [value.toLocaleString(), ""]) as never}
          />
          <Legend />
          {groupKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="counts" fill={palette[i % palette.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function labelForDecile(decile: number | null): string {
  if (decile === null) return "Unknown";
  const start = decile * 10;
  return `${start}-${start + 9}`;
}
