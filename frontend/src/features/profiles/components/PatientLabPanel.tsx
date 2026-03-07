import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, FlaskConical, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicalEvent } from "../types/profile";

interface PatientLabPanelProps {
  events: ClinicalEvent[];
}

interface LabGroup {
  concept_id: number;
  concept_name: string;
  unit: string;
  values: { date: string; value: number }[];
  range_low: number | null;
  range_high: number | null;
  latest: number;
  count: number;
  vocabulary: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Sparkline({
  values,
  rangeLow,
  rangeHigh,
}: {
  values: number[];
  rangeLow: number | null;
  rangeHigh: number | null;
}) {
  if (values.length === 0) return null;

  const w = 100;
  const h = 28;
  const pad = 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const toY = (v: number) => pad + ((max - v) / range) * (h - pad * 2);
  const toX = (i: number) =>
    pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);

  const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
    >
      {/* Reference range band */}
      {rangeLow != null && rangeHigh != null && (
        <rect
          x={pad}
          y={toY(Math.min(rangeHigh, max))}
          width={w - pad * 2}
          height={Math.max(
            toY(Math.max(rangeLow, min)) - toY(Math.min(rangeHigh, max)),
            0,
          )}
          fill="#22C55E"
          opacity={0.12}
        />
      )}
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#818CF8"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Latest dot */}
      {values.length > 0 && (
        <circle
          cx={toX(values.length - 1)}
          cy={toY(values[values.length - 1])}
          r={2.5}
          fill="#818CF8"
        />
      )}
    </svg>
  );
}

function RangeIndicator({
  value,
  rangeLow,
  rangeHigh,
}: {
  value: number;
  rangeLow: number | null;
  rangeHigh: number | null;
}) {
  if (rangeLow == null || rangeHigh == null) {
    return <Minus size={12} className="text-[#5A5650]" />;
  }
  if (value < rangeLow) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#818CF8]">
        <TrendingDown size={11} />
        Low
      </span>
    );
  }
  if (value > rangeHigh) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#E85A6B]">
        <TrendingUp size={11} />
        High
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#22C55E]">
      <Minus size={11} />
      Normal
    </span>
  );
}

function LabRow({ group }: { group: LabGroup }) {
  const [expanded, setExpanded] = useState(false);
  const sparkValues = group.values.map((v) => v.value);

  // Trend: compare latest vs second-to-last
  const trend =
    group.values.length >= 2
      ? group.latest > group.values[group.values.length - 2].value
        ? "up"
        : group.latest < group.values[group.values.length - 2].value
          ? "down"
          : "flat"
      : "flat";

  return (
    <div className="border-b border-[#1C1C20] last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1A1A1E] transition-colors text-left"
      >
        {/* Expand toggle */}
        <span className="text-[#5A5650] shrink-0">
          {expanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>

        {/* Concept name */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#F0EDE8] truncate">
            {group.concept_name}
          </p>
          {group.vocabulary && (
            <p className="text-[10px] text-[#5A5650]">{group.vocabulary}</p>
          )}
        </div>

        {/* Count */}
        <span className="text-[10px] text-[#5A5650] shrink-0 w-8 text-right">
          ×{group.count}
        </span>

        {/* Sparkline */}
        <div className="shrink-0">
          <Sparkline
            values={sparkValues}
            rangeLow={group.range_low}
            rangeHigh={group.range_high}
          />
        </div>

        {/* Latest value */}
        <div className="shrink-0 w-28 text-right">
          <p className="text-sm font-bold text-[#F0EDE8]">
            {group.latest.toLocaleString(undefined, { maximumFractionDigits: 3 })}
            {group.unit ? (
              <span className="text-[10px] font-normal text-[#8A857D] ml-1">
                {group.unit}
              </span>
            ) : null}
          </p>
          {group.range_low != null && group.range_high != null && (
            <p className="text-[9px] text-[#5A5650]">
              ref: {group.range_low}–{group.range_high}
            </p>
          )}
        </div>

        {/* Trend arrow */}
        <div className="shrink-0 w-6 flex justify-center">
          {trend === "up" ? (
            <TrendingUp size={14} className="text-[#E85A6B]" />
          ) : trend === "down" ? (
            <TrendingDown size={14} className="text-[#818CF8]" />
          ) : (
            <Minus size={14} className="text-[#5A5650]" />
          )}
        </div>

        {/* Range indicator */}
        <div className="shrink-0 w-14">
          <RangeIndicator
            value={group.latest}
            rangeLow={group.range_low}
            rangeHigh={group.range_high}
          />
        </div>
      </button>

      {/* Expanded: value history table */}
      {expanded && (
        <div className="px-4 pb-3 bg-[#0E0E11]">
          <table className="w-full">
            <thead>
              <tr>
                <th className="py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                  Date
                </th>
                <th className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                  Value
                </th>
                <th className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                  Range
                </th>
                <th className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {[...group.values]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                )
                .map((v, i) => (
                  <tr key={i} className="border-t border-[#1C1C20]">
                    <td className="py-1.5 text-[11px] text-[#8A857D]">
                      {formatDate(v.date)}
                    </td>
                    <td className="py-1.5 text-right text-[11px] font-medium text-[#F0EDE8]">
                      {v.value.toLocaleString(undefined, {
                        maximumFractionDigits: 3,
                      })}
                      {group.unit && (
                        <span className="text-[#5A5650] ml-1">{group.unit}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-[10px] text-[#5A5650]">
                      {group.range_low != null && group.range_high != null
                        ? `${group.range_low}–${group.range_high}`
                        : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      <RangeIndicator
                        value={v.value}
                        rangeLow={group.range_low}
                        rangeHigh={group.range_high}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function PatientLabPanel({ events }: PatientLabPanelProps) {
  const [search, setSearch] = useState("");

  // Group measurements by concept
  const labGroups = useMemo<LabGroup[]>(() => {
    const measurements = events.filter((e) => e.domain === "measurement");
    const grouped = new Map<number, LabGroup>();

    for (const m of measurements) {
      const raw = m.value;
      const numVal = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : null;
      if (numVal == null || isNaN(numVal)) continue; // skip non-numeric measurements

      const existing = grouped.get(m.concept_id);
      if (existing) {
        existing.values.push({ date: m.start_date, value: numVal });
        existing.count++;
        // Keep the latest range/unit from most recent entry
        if (
          !existing.range_low &&
          m.range_low != null
        ) {
          existing.range_low = typeof m.range_low === "string" ? Number(m.range_low) : m.range_low;
          existing.range_high = m.range_high != null ? (typeof m.range_high === "string" ? Number(m.range_high) : m.range_high) : null;
        }
        if (!existing.unit && m.unit) {
          existing.unit = m.unit;
        }
      } else {
        grouped.set(m.concept_id, {
          concept_id: m.concept_id,
          concept_name: m.concept_name,
          unit: m.unit ?? "",
          values: [{ date: m.start_date, value: numVal }],
          range_low: m.range_low != null ? (typeof m.range_low === "string" ? Number(m.range_low) : m.range_low) : null,
          range_high: m.range_high != null ? (typeof m.range_high === "string" ? Number(m.range_high) : m.range_high) : null,
          latest: numVal,
          count: 1,
          vocabulary: m.vocabulary ?? "",
        });
      }
    }

    // Sort values by date, set latest
    const groups = Array.from(grouped.values()).map((g) => {
      const sorted = [...g.values].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      return {
        ...g,
        values: sorted,
        latest: sorted[sorted.length - 1].value,
      };
    });

    // Sort groups by concept_name
    return groups.sort((a, b) => a.concept_name.localeCompare(b.concept_name));
  }, [events]);

  const filtered = useMemo(() => {
    if (!search.trim()) return labGroups;
    const q = search.toLowerCase();
    return labGroups.filter((g) => g.concept_name.toLowerCase().includes(q));
  }, [labGroups, search]);

  const numericMeasurements = labGroups.reduce((s, g) => s + g.count, 0);
  const totalMeasurements = events.filter((e) => e.domain === "measurement").length;
  const nonNumeric = totalMeasurements - numericMeasurements;

  if (labGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <FlaskConical size={24} className="text-[#5A5650] mb-3" />
        <p className="text-sm text-[#8A857D]">No lab measurements available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#1C1C20] border-b border-[#232328]">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-[#818CF8]" />
          <span className="text-xs font-semibold text-[#F0EDE8]">
            Lab Panel
          </span>
          <span className="text-[10px] text-[#5A5650]">
            {labGroups.length} tests · {numericMeasurements} numeric values
            {nonNumeric > 0 ? ` · ${nonNumeric} non-numeric` : ""}
          </span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter tests..."
          className={cn(
            "w-48 rounded-md border border-[#323238] bg-[#0E0E11] px-3 py-1 text-xs",
            "text-[#F0EDE8] placeholder:text-[#5A5650]",
            "focus:border-[#818CF8] focus:outline-none focus:ring-1 focus:ring-[#818CF8]/20",
          )}
        />
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#151518] border-b border-[#232328]">
        <div className="w-5 shrink-0" />
        <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
          Test
        </div>
        <div className="w-8 text-right text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
          N
        </div>
        <div className="w-[100px] text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
          Trend
        </div>
        <div className="w-28 text-right text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
          Latest
        </div>
        <div className="w-6" />
        <div className="w-14 text-right text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
          Status
        </div>
      </div>

      {/* Lab rows */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-24">
          <p className="text-sm text-[#8A857D]">No tests match "{search}"</p>
        </div>
      ) : (
        filtered.map((group) => <LabRow key={group.concept_id} group={group} />)
      )}
    </div>
  );
}
