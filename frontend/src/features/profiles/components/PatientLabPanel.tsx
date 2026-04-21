import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, FlaskConical, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LabGroup } from "../types/profile";
import { LabTrendChart } from "./LabTrendChart";
import { LabValuesTable } from "./LabValuesTable";

interface PatientLabPanelProps {
  labGroups: LabGroup[];
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
          fill="var(--success)"
          opacity={0.12}
        />
      )}
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="var(--info)"
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
          fill="var(--info)"
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
  const { t } = useTranslation("app");

  if (rangeLow == null || rangeHigh == null) {
    return <Minus size={12} className="text-text-ghost" />;
  }
  if (value < rangeLow) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-info">
        <TrendingDown size={11} />
        {t("profiles.labs.status.low")}
      </span>
    );
  }
  if (value > rangeHigh) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-critical">
        <TrendingUp size={11} />
        {t("profiles.labs.status.high")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success">
      <Minus size={11} />
      {t("profiles.labs.status.normal")}
    </span>
  );
}

function LabRow({ group }: { group: LabGroup }) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(false);
  const [showValues, setShowValues] = useState(false);

  const sparkValues = group.values
    .filter((v) => v.value != null)
    .map((v) => v.value as number);

  const trend = group.trend;

  return (
    <div className="border-b border-border-subtle last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-overlay transition-colors text-left"
      >
        {/* Expand toggle */}
        <span className="text-text-ghost shrink-0">
          {expanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>

        {/* Concept name */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary truncate">
            {group.conceptName}
          </p>
        </div>

        {/* Count */}
        <span className="text-[10px] text-text-ghost shrink-0 w-8 text-right">
          ×{group.n}
        </span>

        {/* Sparkline */}
        <div className="shrink-0">
          <Sparkline
            values={sparkValues}
            rangeLow={group.range?.low ?? null}
            rangeHigh={group.range?.high ?? null}
          />
        </div>

        {/* Latest value */}
        <div className="shrink-0 w-28 text-right">
          <p className="text-sm font-bold text-text-primary">
            {group.latestValue != null
              ? group.latestValue.toLocaleString(undefined, { maximumFractionDigits: 3 })
              : "—"}
            {group.unitName ? (
              <span className="text-[10px] font-normal text-text-muted ml-1">
                {group.unitName}
              </span>
            ) : null}
          </p>
          {group.range != null && (
            <p className="text-[9px] text-text-ghost">
              {t("profiles.labs.referenceShort")} {group.range.low}–{group.range.high}
            </p>
          )}
        </div>

        {/* Trend arrow */}
        <div className="shrink-0 w-6 flex justify-center">
          {trend === "up" ? (
            <TrendingUp size={14} className="text-critical" />
          ) : trend === "down" ? (
            <TrendingDown size={14} className="text-info" />
          ) : (
            <Minus size={14} className="text-text-ghost" />
          )}
        </div>

        {/* Range indicator */}
        <div className="shrink-0 w-14">
          <RangeIndicator
            value={group.latestValue ?? 0}
            rangeLow={group.range?.low ?? null}
            rangeHigh={group.range?.high ?? null}
          />
        </div>
      </button>

      {/* Expanded: trend chart + optional values table */}
      {expanded && (
        <div className="space-y-2 rounded-md bg-surface-base/40 p-3">
          <LabTrendChart
            conceptName={group.conceptName}
            unitName={group.unitName}
            values={group.values}
            range={group.range}
          />

          <button
            type="button"
            onClick={() => setShowValues((p) => !p)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                showValues && "rotate-90",
              )}
            />
            {showValues
              ? t("profiles.labs.hideValues")
              : t("profiles.labs.showValues")}
          </button>

          {showValues && (
            <LabValuesTable values={group.values} unitName={group.unitName} range={group.range} />
          )}
        </div>
      )}
    </div>
  );
}

export function PatientLabPanel({ labGroups }: PatientLabPanelProps) {
  const { t } = useTranslation("app");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return labGroups;
    const q = search.toLowerCase();
    return labGroups.filter((g) => g.conceptName.toLowerCase().includes(q));
  }, [labGroups, search]);

  const numericMeasurements = labGroups.reduce((s, g) => s + g.n, 0);

  if (labGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <FlaskConical size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">{t("profiles.labs.noMeasurements")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface-overlay border-b border-border-default">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-info" />
          <span className="text-xs font-semibold text-text-primary">
            {t("profiles.labs.panelTitle")}
          </span>
          <span className="text-[10px] text-text-ghost">
            {t("profiles.labs.summary", {
              tests: labGroups.length,
              values: numericMeasurements,
            })}
          </span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("profiles.labs.filterTests")}
          className={cn(
            "w-48 rounded-md border border-surface-highlight bg-surface-base px-3 py-1 text-xs",
            "text-text-primary placeholder:text-text-ghost",
            "focus:border-info focus:outline-none focus:ring-1 focus:ring-info/20",
          )}
        />
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-raised border-b border-border-default">
        <div className="w-5 shrink-0" />
        <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("profiles.labs.test")}
        </div>
        <div className="w-8 text-right text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("profiles.labs.countHeader")}
        </div>
        <div className="w-[100px] text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("profiles.labs.trend")}
        </div>
        <div className="w-28 text-right text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("profiles.labs.latest")}
        </div>
        <div className="w-6" />
        <div className="w-14 text-right text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("profiles.common.table.status")}
        </div>
      </div>

      {/* Lab rows */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-24">
          <p className="text-sm text-text-muted">
            {t("profiles.labs.noTestsMatch", { query: search })}
          </p>
        </div>
      ) : (
        filtered.map((group) => <LabRow key={group.conceptId} group={group} />)
      )}
    </div>
  );
}
