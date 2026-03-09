import { cn } from "@/lib/utils";
import { fmt, num } from "@/lib/formatters";
import type { EvidenceSynthesisResult } from "../types/evidenceSynthesis";
import { SiteHeterogeneityMap, type HeterogeneitySite } from "./SiteHeterogeneityMap";

interface EvidenceSynthesisVerdictDashboardProps {
  result: EvidenceSynthesisResult;
}

/** Interpret I-squared heterogeneity */
function heterogeneityLabel(iSquared: number): string {
  if (iSquared < 25) return "Low";
  if (iSquared < 50) return "Moderate";
  if (iSquared < 75) return "Substantial";
  return "Considerable";
}

/** Significance verdict badge */
function SignificanceVerdictBadge({ hr, ciLower, ciUpper }: { hr: number; ciLower: number; ciUpper: number }) {
  const isSignificant = ciLower > 1 || ciUpper < 1;
  const isProtective = hr < 1 && ciUpper < 1;
  const isHarmful = hr > 1 && ciLower > 1;

  let label: string;
  let color: string;
  if (isProtective) {
    label = "Significant (Protective)";
    color = "text-[#2DD4BF] border-[#2DD4BF]/30 bg-[#2DD4BF]/5";
  } else if (isHarmful) {
    label = "Significant (Harmful)";
    color = "text-[#E85A6B] border-[#E85A6B]/30 bg-[#E85A6B]/5";
  } else if (isSignificant) {
    label = "Significant";
    color = "text-[#C9A227] border-[#C9A227]/30 bg-[#C9A227]/5";
  } else {
    label = "Not Significant";
    color = "text-[#8A857D] border-[#8A857D]/30 bg-[#8A857D]/5";
  }

  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border", color)}>
      {label}
    </span>
  );
}

export function EvidenceSynthesisVerdictDashboard({ result }: EvidenceSynthesisVerdictDashboardProps) {
  const { pooled, per_site, method } = result;
  const hr = num(pooled.hr);
  const ciLower = num(pooled.ci_lower);
  const ciUpper = num(pooled.ci_upper);
  const tau = num(pooled.tau);
  const isBayesian = method === "bayesian";
  const methodLabel = isBayesian ? "Bayesian RE" : "Fixed Effect";

  // Compute I-squared from per-site data
  // I² = max(0, (Q - df) / Q * 100) where Q = sum of (logRR_i - logRR_pooled)^2 / se_i^2
  const logRrPooled = num(pooled.log_rr);
  const sites = per_site ?? [];
  const df = sites.length - 1;

  let cochranQ = 0;
  const weights: number[] = [];
  for (const site of sites) {
    const se = num(site.se_log_rr);
    if (se > 0) {
      const w = 1 / (se * se);
      weights.push(w);
      cochranQ += w * Math.pow(num(site.log_rr) - logRrPooled, 2);
    } else {
      weights.push(0);
    }
  }
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const iSquared = df > 0 ? Math.max(0, ((cochranQ - df) / cochranQ) * 100) : 0;
  const tauSquared = tau * tau;

  // Cochran Q p-value (chi-squared with df degrees of freedom) — approximate
  const cochranQPvalue = df > 0 ? chiSquaredSurvival(cochranQ, df) : null;

  // Prediction interval: pooled ± 1.96 * tau (for random effects)
  const piLower = isBayesian && tau > 0 ? Math.exp(logRrPooled - 1.96 * tau) : null;
  const piUpper = isBayesian && tau > 0 ? Math.exp(logRrPooled + 1.96 * tau) : null;

  // Site agreement
  const protectiveSites = sites.filter((s) => num(s.hr) < 1).length;

  // Build heterogeneity map sites
  const mapSites: HeterogeneitySite[] = sites.map((site, idx) => ({
    site_name: site.site_name,
    hr: num(site.hr),
    ci_lower: num(site.ci_lower),
    ci_upper: num(site.ci_upper),
    weight: totalWeight > 0 ? (weights[idx] / totalWeight) * 100 : 100 / sites.length,
  }));

  return (
    <div className="space-y-4">
      {/* Top row: Pooled HR + Significance */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-[#8A857D] mb-1">{methodLabel} Pooled Estimate</p>
            <p className="text-3xl font-bold font-mono text-[#F0EDE8]">
              HR {fmt(hr)}
            </p>
            <p className="text-sm font-mono text-[#C5C0B8] mt-1">
              95% CI [{fmt(ciLower)}, {fmt(ciUpper)}]
              {piLower != null && piUpper != null && (
                <span className="text-[#8A857D] ml-3">
                  PI [{fmt(piLower)}, {fmt(piUpper)}]
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <SignificanceVerdictBadge hr={hr} ciLower={ciLower} ciUpper={ciUpper} />
            <p className="text-xs text-[#8A857D]">
              {protectiveSites} of {sites.length} sites show protective effect
            </p>
          </div>
        </div>
      </div>

      {/* Heterogeneity summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="I-squared"
          value={`${fmt(iSquared, 1)}%`}
          subtitle={heterogeneityLabel(iSquared)}
        />
        <MetricCard
          label="Tau-squared"
          value={fmt(tauSquared, 4)}
          subtitle="Between-study variance"
        />
        <MetricCard
          label="Cochran's Q"
          value={fmt(cochranQ, 2)}
          subtitle={cochranQPvalue != null ? `p = ${fmtPValue(cochranQPvalue)}` : `df = ${df}`}
        />
        <MetricCard
          label="Sites"
          value={`${protectiveSites}/${sites.length}`}
          subtitle="Protective effect"
        />
      </div>

      {/* Heterogeneity map */}
      {mapSites.length > 0 && (
        <SiteHeterogeneityMap sites={mapSites} pooledHr={hr} />
      )}
    </div>
  );
}

function MetricCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 text-center">
      <p className="text-lg font-bold text-[#F0EDE8] font-mono">{value}</p>
      <p className="text-xs text-[#8A857D] mt-1">{label}</p>
      <p className="text-[10px] text-[#5A5650] mt-0.5">{subtitle}</p>
    </div>
  );
}

/** Format p-value with appropriate precision */
function fmtPValue(p: number): string {
  if (p < 0.001) return "<0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}

/**
 * Approximate chi-squared survival function P(X > x) for df degrees of freedom.
 * Uses the regularized incomplete gamma function approximation.
 */
function chiSquaredSurvival(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 1;
  // P(X > x) = 1 - regularizedGammaLower(df/2, x/2)
  return 1 - regularizedGammaLower(df / 2, x / 2);
}

/** Regularized lower incomplete gamma function via series expansion */
function regularizedGammaLower(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x > a + 20) {
    // Use continued fraction for large x (upper incomplete gamma)
    return 1 - regularizedGammaUpper(a, x);
  }

  let sum = 1 / a;
  let term = 1 / a;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularized upper incomplete gamma via continued fraction (Lentz) */
function regularizedGammaUpper(a: number, x: number): number {
  let f = 1e-30;
  let c = 1e-30;
  let d = 1 / (x + 1 - a);
  f = d;

  for (let n = 1; n < 200; n++) {
    const an = n * (a - n);
    const bn = x + 2 * n + 1 - a;
    d = 1 / (bn + an * d);
    c = bn + an / c;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }

  return f * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Log-gamma function (Stirling approximation) */
function logGamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) {
    x += coef[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
