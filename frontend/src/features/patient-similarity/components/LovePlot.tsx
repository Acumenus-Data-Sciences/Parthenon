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
import { useTranslation } from "react-i18next";
import type { CovariateBalanceRow } from "../types/patientSimilarity";

const TEAL = "var(--color-primary)";
const CRIMSON = "var(--color-critical)";

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
  const { t } = useTranslation("app");
  const sorted = [...covariates]
    .sort((a, b) => Math.abs(b.smd) - Math.abs(a.smd))
    .slice(0, maxDisplay);

  const data: DotDatum[] = sorted.map((row, i) => ({
    covariate: truncateLabel(row.covariate),
    absSmd: Math.abs(row.smd),
    idx: i,
  }));

  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        {t("patientSimilarity.charts.covariateBalanceSmd")}
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        {t("patientSimilarity.charts.covariatesBalanced")}
      </p>
      <ResponsiveContainer width="100%" height={Math.max(300, data.length * 22)}>
        <ScatterChart
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 20, left: 140 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-overlay)" horizontal={false} />
          <XAxis
            type="number"
            dataKey="absSmd"
            domain={[0, "auto"]}
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            name="|SMD|"
            label={{ value: "|SMD|", position: "bottom", fill: "var(--color-text-muted)", fontSize: 11, offset: 0 }}
          />
          <YAxis
            type="category"
            dataKey="covariate"
            width={135}
            tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
            name={t("patientSimilarity.charts.covariate")}
          />
          <ReferenceLine x={0.1} stroke="var(--color-primary)" strokeDasharray="5 5" label={{ value: "0.1", fill: "var(--color-primary)", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={((value: unknown) => [typeof value === "number" ? value.toFixed(4) : String(value), "|SMD|"]) as never}
          />
          <Scatter
            data={data}
            fill={TEAL}
            name="|SMD|"
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
  const { t } = useTranslation("app");
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
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        {t("patientSimilarity.charts.lovePlotBeforeAfter")}
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        {t("patientSimilarity.charts.lovePlotBeforeAfterHelp")}
      </p>
      <ResponsiveContainer width="100%" height={Math.max(300, displayed.length * 22)}>
        <ScatterChart
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 20, left: 140 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-overlay)" horizontal={false} />
          <XAxis
            type="number"
            dataKey="absSmd"
            domain={[0, "auto"]}
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            name="|SMD|"
            label={{ value: "|SMD|", position: "bottom", fill: "var(--color-text-muted)", fontSize: 11, offset: 0 }}
          />
          <YAxis
            type="category"
            dataKey="covariate"
            width={135}
            tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
            name={t("patientSimilarity.charts.covariate")}
          />
          <ReferenceLine x={0.1} stroke="var(--color-primary)" strokeDasharray="5 5" label={{ value: "0.1", fill: "var(--color-primary)", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={((value: unknown, name: string) => [
              typeof value === "number" ? value.toFixed(4) : String(value),
              name === t("patientSimilarity.charts.before")
                ? t("patientSimilarity.charts.beforeAbsSmd")
                : t("patientSimilarity.charts.afterAbsSmd"),
            ]) as never}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--color-text-primary)" }}
          />
          <Scatter
            data={beforeData}
            fill={CRIMSON}
            name={t("patientSimilarity.charts.before")}
            shape="circle"
          />
          <Scatter
            data={afterData}
            fill={TEAL}
            name={t("patientSimilarity.charts.after")}
            shape="circle"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
