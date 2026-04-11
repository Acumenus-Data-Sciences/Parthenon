import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import type { ProInstrument } from "../types/proInstrument";
import { DOMAIN_COLORS, OMOP_COLORS } from "../types/proInstrument";

interface CoverageChartProps {
  instruments: ProInstrument[];
}

export function CoverageChart({ instruments }: CoverageChartProps) {
  const domainData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inst of instruments) {
      counts.set(inst.domain, (counts.get(inst.domain) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({
        domain,
        count,
        fill: DOMAIN_COLORS[domain] ?? "var(--text-ghost)",
      }));
  }, [instruments]);

  const omopData = useMemo(() => {
    let yes = 0;
    let partial = 0;
    let no = 0;
    for (const inst of instruments) {
      if (inst.omopCoverage === "yes") yes++;
      else if (inst.omopCoverage === "partial") partial++;
      else no++;
    }
    return [
      { name: "Full Coverage", value: yes, fill: OMOP_COLORS.yes },
      { name: "Partial", value: partial, fill: OMOP_COLORS.partial },
      { name: "No Coverage", value: no, fill: OMOP_COLORS.no },
    ];
  }, [instruments]);

  const loincData = useMemo(() => {
    const withLoinc = instruments.filter((i) => i.hasLoinc).length;
    const without = instruments.length - withLoinc;
    return [
      { name: "Has LOINC", value: withLoinc, fill: "var(--success)" },
      { name: "No LOINC", value: without, fill: "var(--text-ghost)" },
    ];
  }, [instruments]);

  const snomedData = useMemo(() => {
    const withSnomed = instruments.filter((i) => i.hasSnomed).length;
    const without = instruments.length - withSnomed;
    return [
      { name: "Has SNOMED", value: withSnomed, fill: "#F59E0B" },
      { name: "No SNOMED", value: without, fill: "var(--text-ghost)" },
    ];
  }, [instruments]);

  const licenseData = useMemo(() => {
    const pub = instruments.filter((i) => i.license === "public").length;
    const prop = instruments.length - pub;
    return [
      { name: "Public Domain", value: pub, fill: "var(--success)" },
      { name: "Proprietary", value: prop, fill: "var(--accent)" },
    ];
  }, [instruments]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Domain distribution */}
      <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">
          Instruments by Clinical Domain
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(320, domainData.length * 28)}>
          <BarChart
            data={domainData}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "#2A2A2F" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="domain"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141418",
                border: "1px solid #2A2A2F",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--text-primary)" }}
              formatter={
                ((value: number) => [
                  `${value} instrument${value !== 1 ? "s" : ""}`,
                  "",
                ]) as never
              }
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
              {domainData.map((entry) => (
                <Cell key={entry.domain} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Right column: 3 pie/donut charts */}
      <div className="space-y-4">
        {/* OMOP Coverage */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">
            OMOP Concept Coverage
          </h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie
                  data={omopData}
                  innerRadius={28}
                  outerRadius={44}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {omopData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {omopData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-text-secondary">{entry.name}</span>
                  </div>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-primary">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LOINC Coverage */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">
            LOINC Code Availability
          </h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie
                  data={loincData}
                  innerRadius={28}
                  outerRadius={44}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {loincData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {loincData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-text-secondary">{entry.name}</span>
                  </div>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-primary">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SNOMED Coverage */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">
            SNOMED CT Coverage
          </h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie
                  data={snomedData}
                  innerRadius={28}
                  outerRadius={44}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {snomedData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {snomedData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-text-secondary">{entry.name}</span>
                  </div>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-primary">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* License breakdown */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">
            License Distribution
          </h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie
                  data={licenseData}
                  innerRadius={28}
                  outerRadius={44}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {licenseData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {licenseData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-text-secondary">{entry.name}</span>
                  </div>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-primary">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
