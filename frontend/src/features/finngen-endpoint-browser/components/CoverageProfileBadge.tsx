// Phase 13 — portability pill rendered next to an endpoint name and in
// the detail drawer header. Surfaces App\Enums\CoverageProfile from the
// API so researchers know whether a FinnGen endpoint resolves on the
// currently-available CDMs BEFORE they try to generate it.
//
// See CONTEXT D-08 (UX spec) and Plan 07 acceptance criteria.
import type { CoverageProfile } from "../api";

export type CoverageProfileBadgeProps = {
  profile: CoverageProfile | null;
  className?: string;
};

/**
 * Visual mapping:
 *
 *   finland_only → amber pill "Requires Finnish CDM"
 *                  (warning tone: endpoint depends on ICD-8 / NOMESCO /
 *                   KELA_REIMB / ICDO3-FI; no Parthenon CDM carries
 *                   those today — v1.0 Finnish source list is empty)
 *
 *   partial      → slate pill "Partial coverage"
 *                  (some branches map, some are Finnish-only; worker
 *                   will search the mappable subset)
 *
 *   universal    → render nothing (happy path; no visual noise)
 *   null         → render nothing (Plan 06 --overwrite not yet run)
 *
 * Tailwind classes follow the FinnGenEndpointBrowserPage conventions:
 * amber for warnings (matches BUCKET_META.PARTIAL), slate for neutral.
 */
export function CoverageProfileBadge({
  profile,
  className,
}: CoverageProfileBadgeProps) {
  if (profile === "finland_only") {
    return (
      <span
        data-testid="coverage-profile-badge-finland-only"
        className={`inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 ${className ?? ""}`}
        title="This endpoint depends on Finnish source vocabularies (ICD-8, NOMESCO, KELA_REIMB, ICDO3-FI) that are not present in any non-Finnish CDM."
      >
        Requires Finnish CDM
      </span>
    );
  }
  if (profile === "partial") {
    return (
      <span
        data-testid="coverage-profile-badge-partial"
        className={`inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${className ?? ""}`}
        title="Some qualifying-event branches resolve to standard concepts; others are Finnish-only. The generated cohort may underestimate the true subject count."
      >
        Partial coverage
      </span>
    );
  }
  // universal or null — render nothing.
  return null;
}
