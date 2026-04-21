// Phase 17 GENOMICS-08 — cohort drawer PRS distribution panel.
// Renders Recharts BarChart + 5 quintile ReferenceArea bands + summary stats
// + CSV download link. Empty state surfaces a "Compute PRS" CTA the parent
// page hands off to ComputePrsModal via `onCompute`.
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { useCohortPrsScores } from "../hooks/usePrsScores";
import { buildPrsDownloadUrl, type PrsScoreResult } from "../api/prs";
import { useTranslation } from "react-i18next";

interface Props {
  cohortId: number;
  bins?: number;
  onCompute?: () => void;
}

interface QuintileBand {
  x1: number;
  x2: number;
  opacity: number;
}

interface HistogramDatum {
  bin_mid: number;
  count: number;
  bin_lo: number;
  bin_hi: number;
}

// Format to 3 significant figures, handling null/undefined/non-finite.
function fmt(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Number(v).toPrecision(digits);
}

function buildBands(score: PrsScoreResult): QuintileBand[] {
  const min = score.summary.min ?? 0;
  const max = score.summary.max ?? 1;
  const q = score.quintiles;
  const opacities = [0.1, 0.2, 0.3, 0.2, 0.1]; // symmetric, darkest at median
  const edges: Array<[number | null, number | null]> = [
    [min, q.q20],
    [q.q20, q.q40],
    [q.q40, q.q60],
    [q.q60, q.q80],
    [q.q80, max],
  ];
  const bands: QuintileBand[] = [];
  edges.forEach(([x1, x2], i) => {
    if (x1 !== null && x2 !== null) {
      bands.push({ x1, x2, opacity: opacities[i] });
    }
  });
  return bands;
}

function buildHistogramData(score: PrsScoreResult): HistogramDatum[] {
  return score.histogram.map((h) => ({
    bin_mid: (h.bin_lo + h.bin_hi) / 2,
    count: h.n,
    bin_lo: h.bin_lo,
    bin_hi: h.bin_hi,
  }));
}

export function PrsDistributionPanel({
  cohortId,
  bins = 50,
  onCompute,
}: Props) {
  const { t } = useTranslation("app");
  const { data, isLoading, error } = useCohortPrsScores(cohortId, bins);
  const scores = useMemo(() => data?.scores ?? [], [data?.scores]);
  const [selectedScoreId, setSelectedScoreId] = useState<string>("");

  const selected: PrsScoreResult | undefined = useMemo(
    () => scores.find((s) => s.score_id === selectedScoreId) ?? scores[0],
    [scores, selectedScoreId],
  );

  if (isLoading) {
    return (
      <div
        role="status"
        className="p-6 text-sm text-text-muted"
        aria-live="polite"
      >
        {t("cohortDefinitions.auto.loadingPrsScores_8bd381")}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-6 text-sm text-critical">
        {t("cohortDefinitions.auto.errorLoadingPrsScores_0d56cb")} {(error as Error).message}
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="p-6 rounded border border-border-default text-center">
        <p className="text-sm mb-3 text-text-muted">
          {t("cohortDefinitions.auto.noPolygenicRiskScoresComputedForThisCohort_98c512")}
        </p>
        <button
          type="button"
          onClick={onCompute}
          className="px-4 py-2 rounded bg-[color:var(--color-crimson)] text-white text-sm hover:opacity-90"
        >
          {t("cohortDefinitions.auto.computePrs_0d8599")}
        </button>
      </div>
    );
  }

  const bands = selected ? buildBands(selected) : [];
  const histogramData = selected ? buildHistogramData(selected) : [];
  const xMin = selected?.summary.min ?? 0;
  const xMax = selected?.summary.max ?? 1;

  return (
    <section aria-label={t("cohortDefinitions.auto.prsDistribution_f9eb79")} className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <label className="text-sm flex items-center gap-2">
          <span className="text-text-muted">{t("cohortDefinitions.auto.score_343bc2")}</span>
          <select
            aria-label={t("cohortDefinitions.auto.selectPrsScore_301cb5")}
            value={selected?.score_id ?? ""}
            onChange={(e) => setSelectedScoreId(e.target.value)}
            className="px-2 py-1 rounded bg-surface-raised border border-border-default text-text-primary"
          >
            {scores.map((s) => (
              <option key={s.score_id} value={s.score_id}>
                {s.trait_reported ?? "(no trait)"} — {s.score_id}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <a
            href={buildPrsDownloadUrl(cohortId, selected.score_id)}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline text-[color:var(--color-teal)]"
          >
            {t("cohortDefinitions.auto.downloadCsv_54df95")}
          </a>
        )}
      </header>

      {selected && (
        <>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={histogramData}
                margin={{ top: 16, right: 16, bottom: 32, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-default)"
                />
                <XAxis
                  dataKey="bin_mid"
                  type="number"
                  domain={[xMin, xMax]}
                  scale="linear"
                  stroke="var(--text-secondary)"
                  fontSize={11}
                />
                <YAxis stroke="var(--text-secondary)" fontSize={11} />
                {bands.map((b, i) => (
                  <ReferenceArea
                    key={i}
                    x1={b.x1}
                    x2={b.x2}
                    fill="var(--color-crimson)"
                    fillOpacity={b.opacity}
                  />
                ))}
                <Bar dataKey="count" fill="var(--color-teal)" />
                <Tooltip
                  formatter={
                    ((v: number) => [`${v}`, "subjects"]) as never
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">{t("cohortDefinitions.auto.subjects_8b2f77")}</dt>
              <dd>{selected.subject_count}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cohortDefinitions.auto.mean_3d6c9a")}</dt>
              <dd>{fmt(selected.summary.mean)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cohortDefinitions.auto.median_66851a")}</dt>
              <dd>{fmt(selected.summary.median)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">SD</dt>
              <dd>{fmt(selected.summary.stddev)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cohortDefinitions.auto.min_78d811")}</dt>
              <dd>{fmt(selected.summary.min)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cohortDefinitions.auto.max_6a0613")}</dt>
              <dd>{fmt(selected.summary.max)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cohortDefinitions.auto.iqrQ1_3cfd5d")}</dt>
              <dd>{fmt(selected.summary.iqr_q1)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cohortDefinitions.auto.iqrQ3_092075")}</dt>
              <dd>{fmt(selected.summary.iqr_q3)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
