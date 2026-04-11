import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { CovariateBalanceRow } from "../types/patientSimilarity";

const TEAL = "var(--success)";
const CRIMSON = "var(--primary)";

interface LovePlotProps {
  covariates: CovariateBalanceRow[];
  beforeCovariates?: CovariateBalanceRow[];
  maxDisplay?: number;
}

interface DotDatum {
  covariate: string;
  absSmd: number;
  idx: number;
}

function truncateLabel(label: string, maxLen: number = 28): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + "\u2026";
}

export function LovePlot({
  covariates,
  beforeCovariates,
  maxDisplay = 30,
}: LovePlotProps) {
  const hasBeforeAfter = beforeCovariates !== undefined && beforeCovariates.length > 0;

  if (hasBeforeAfter) {
    return (
      <BeforeAfterLovePlot
        after={covariates}
        before={beforeCovariates}
        maxDisplay={maxDisplay}
      />
    );
  }

  // Single-state bar chart (backward compatible)
  return (
    <SingleLovePlot covariates={covariates} maxDisplay={maxDisplay} />
  );
}

// ── Single-state Love Plot (SMD bars) ────────────────────────────

function SingleLovePlot({
  covariates,
  maxDisplay,
}: {
  covariates: CovariateBalanceRow[];
  maxDisplay: number;
}) {
  const sorted = [...covariates]
    .sort((a, b) => Math.abs(b.smd) - Math.abs(a.smd))
    .slice(0, maxDisplay);

  const data: DotDatum[] = sorted.map((row, i) => ({
    covariate: truncateLabel(row.covariate),
    absSmd: Math.abs(row.smd),
    idx: i,
  }));

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-1">
        Covariate Balance (|SMD|)
      </h3>
      <p className="text-xs text-text-ghost mb-3">
        Covariates below 0.1 are considered well-balanced
      </p>
      <ResponsiveContainer width="100%" height={Math.max(300, data.length * 22)}>
        <ScatterChart
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 20, left: 140 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
          <XAxis
            type="number"
            dataKey="absSmd"
            domain={[0, "auto"]}
            tick={{ fill: "var(--text-ghost)", fontSize: 10 }}
            name="|SMD|"
            label={{ value: "|SMD|", position: "bottom", fill: "var(--text-ghost)", fontSize: 11, offset: 0 }}
          />
          <YAxis
            type="category"
            dataKey="covariate"
            width={135}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            name="Covariate"
          />
          <ReferenceLine x={0.1} stroke="var(--accent)" strokeDasharray="5 5" label={{ value: "0.1", fill: "var(--accent)", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-overlay)",
              border: "1px solid var(--surface-highlight)",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={((value: unknown) => [typeof value === "number" ? value.toFixed(4) : String(value), "|SMD|"]) as never}
          />
          <Scatter
            data={data}
            fill={TEAL}
            name="SMD"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Before/After Love Plot (dot comparison) ────────────────────

function BeforeAfterLovePlot({
  before,
  after,
  maxDisplay,
}: {
  before: CovariateBalanceRow[];
  after: CovariateBalanceRow[];
  maxDisplay: number;
}) {
  // Build lookup by covariate name
  const beforeMap = new Map(before.map((r) => [r.covariate, Math.abs(r.smd)]));
  const afterMap = new Map(after.map((r) => [r.covariate, Math.abs(r.smd)]));

  // Union of covariates, sorted by before SMD descending
  const allCovariates = [...new Set([...before.map((r) => r.covariate), ...after.map((r) => r.covariate)])];
  allCovariates.sort((a, b) => (beforeMap.get(b) ?? 0) - (beforeMap.get(a) ?? 0));
  const displayed = allCovariates.slice(0, maxDisplay);

  const beforeData: DotDatum[] = displayed.map((cov, i) => ({
    covariate: truncateLabel(cov),
    absSmd: beforeMap.get(cov) ?? 0,
    idx: i,
  }));

  const afterData: DotDatum[] = displayed.map((cov, i) => ({
    covariate: truncateLabel(cov),
    absSmd: afterMap.get(cov) ?? 0,
    idx: i,
  }));

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-1">
        Love Plot: Before vs After Matching
      </h3>
      <p className="text-xs text-text-ghost mb-3">
        After-matching dots (teal) should be closer to zero than before-matching dots (crimson)
      </p>
      <ResponsiveContainer width="100%" height={Math.max(300, displayed.length * 22)}>
        <ScatterChart
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 20, left: 140 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
          <XAxis
            type="number"
            dataKey="absSmd"
            domain={[0, "auto"]}
            tick={{ fill: "var(--text-ghost)", fontSize: 10 }}
            name="|SMD|"
            label={{ value: "|SMD|", position: "bottom", fill: "var(--text-ghost)", fontSize: 11, offset: 0 }}
          />
          <YAxis
            type="category"
            dataKey="covariate"
            width={135}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            name="Covariate"
          />
          <ReferenceLine x={0.1} stroke="var(--accent)" strokeDasharray="5 5" label={{ value: "0.1", fill: "var(--accent)", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-overlay)",
              border: "1px solid var(--surface-highlight)",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={((value: unknown, name: string) => [
              typeof value === "number" ? value.toFixed(4) : String(value),
              name === "Before" ? "Before |SMD|" : "After |SMD|",
            ]) as never}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
          />
          <Scatter
            data={beforeData}
            fill={CRIMSON}
            name="Before"
            shape="circle"
          />
          <Scatter
            data={afterData}
            fill={TEAL}
            name="After"
            shape="circle"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
