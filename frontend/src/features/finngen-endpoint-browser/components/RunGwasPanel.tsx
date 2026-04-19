// Phase 15 Plan 15-06 — RunGwasPanel (UI-SPEC §Layout Section 3 / D-22).
//
// Dispatch form for the single-POST GWAS auto-chain (15-CONTEXT D-01). Collapses
// by default; expands to source + control-cohort + covariate pickers + overwrite
// toggle + CTA. Maps all 10 refusal error_codes from the Plan 15-04 exception
// contract into the UI-SPEC §Copywriting banner copy.
//
// State contract (UI-SPEC §Component Contract RunGwasPanel):
//   sourceKey | controlCohortId | covariateSetId | advancedOpen | overwrite | panelOpen
//
// Derived:
//   sourcesReadyForGwas = endpoint.gwas_ready_sources (backend-computed; D-22 hook)
//   activeCovariateSetId = covariateSetId ?? default.id
//   ctaDisabled = missing source/control/covariate OR pending OR coverageBlocked
//
// A11y:
//   - <button type="button"> with aria-expanded on every disclosure
//   - <label htmlFor> bound to every <select>
//   - alert-role + tabIndex=-1 banner (focus moves there on error)
//   - focus:ring-1 on every control; focus:ring-2 on the primary CTA
//   - 2-weight typography: font-semibold + default 400 only (weight-500 banned)
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Info } from "lucide-react";

import type {
  EndpointDetail,
  EndpointGenerationRun,
  GwasDispatchRefusal,
  GwasDispatchRefusalErrorCode,
} from "../api";
import { useDispatchGwas } from "../hooks/useDispatchGwas";
import { useEligibleControlCohorts } from "../hooks/useEligibleControlCohorts";
import { useCovariateSets } from "../hooks/useCovariateSets";

type RunGwasPanelProps = {
  endpoint: EndpointDetail & { gwas_ready_sources?: string[] };
  generationRuns: EndpointGenerationRun[];
};

function bannerCopy(err: GwasDispatchRefusal): string {
  const byCode: Record<GwasDispatchRefusalErrorCode, string> = {
    unresolvable_concepts: `This endpoint isn't resolvable on any CDM (${err.coverage_bucket ?? "unknown"}). GWAS cannot run.`,
    source_not_found: `Source "${err.source_key ?? ""}" is not registered.`,
    source_not_prepared: `Variant index missing for ${err.source_key ?? ""}. Ask an admin to run 'finngen:prepare-source-variants'.`,
    endpoint_not_materialized: `This endpoint hasn't been generated against ${err.source_key ?? ""} yet. Generate it first.`,
    control_cohort_not_prepared: `The chosen control cohort hasn't been generated against ${err.source_key ?? ""}.`,
    covariate_set_not_found: `Covariate set #${err.covariate_set_id ?? "?"} is not available.`,
    run_in_flight: `A run for this endpoint × source × controls × covariates is already running.`,
    duplicate_run: `A succeeded run already exists. Check "Overwrite existing run" to re-dispatch.`,
    not_owned_run: `Only the owner of the prior run (or an admin) can overwrite it.`,
    endpoint_not_found: `Endpoint not found.`,
  };
  return (
    byCode[err.error_code] ??
    "Could not dispatch GWAS. Please try again in a moment."
  );
}

export function RunGwasPanel({ endpoint, generationRuns: _generationRuns }: RunGwasPanelProps) {
  // _generationRuns is part of the contracted prop surface (UI-SPEC 438-442) so
  // future wiring (non-ready-source helper copy, etc.) can read it without a
  // breaking change. Deliberately unused in v1.0.
  void _generationRuns;
  const [sourceKey, setSourceKey] = useState<string>("");
  const [controlCohortId, setControlCohortId] = useState<number | null>(null);
  const [covariateSetId, setCovariateSetId] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [overwrite, setOverwrite] = useState<boolean>(false);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const overwriteRef = useRef<HTMLInputElement>(null);

  const eligibleControls = useEligibleControlCohorts({
    endpointName: endpoint.name,
    sourceKey,
  });
  const covariateSets = useCovariateSets();
  const dispatch = useDispatchGwas(endpoint.name);

  const sourcesReadyForGwas = useMemo(
    () => endpoint.gwas_ready_sources ?? [],
    [endpoint.gwas_ready_sources],
  );

  const defaultCovariateSet = useMemo(
    () => covariateSets.data?.find((s) => s.is_default),
    [covariateSets.data],
  );

  const activeCovariateSetId =
    covariateSetId ?? defaultCovariateSet?.id ?? null;
  const activeCovariateSet =
    covariateSets.data?.find((s) => s.id === activeCovariateSetId) ??
    defaultCovariateSet;

  const coverageBucket = endpoint.coverage_bucket;
  const coverageBlocked =
    coverageBucket === "CONTROL_ONLY" || coverageBucket === "UNMAPPED";

  const ctaDisabled =
    !sourceKey ||
    !controlCohortId ||
    activeCovariateSetId === null ||
    dispatch.isPending ||
    coverageBlocked;

  const dispatchError = dispatch.error;
  const refusal: GwasDispatchRefusal | null =
    dispatchError !== null &&
    typeof dispatchError === "object" &&
    "error_code" in dispatchError
      ? (dispatchError as GwasDispatchRefusal)
      : null;

  // REVIEW §WR-08 — consolidated into one effect to prevent double focus on
  // duplicate_run refusals (two effects would fire in the same render,
  // flickering the focus ring from banner → checkbox and double-announcing
  // via screen reader). Priority: overwrite checkbox on duplicate_run
  // (the more actionable target — user must tick to retry), banner otherwise.
  useEffect(() => {
    if (!refusal) return;
    if (refusal.error_code === "duplicate_run" && overwriteRef.current) {
      overwriteRef.current.focus();
      return;
    }
    if (bannerRef.current) {
      bannerRef.current.focus();
    }
  }, [refusal]);

  const submit = () => {
    if (!sourceKey || !controlCohortId || activeCovariateSetId === null) return;
    dispatch.mutate(
      {
        source_key: sourceKey,
        control_cohort_id: controlCohortId,
        covariate_set_id:
          activeCovariateSetId === 0 ? null : activeCovariateSetId,
        overwrite,
      },
      {
        onSuccess: () => {
          setPanelOpen(false);
          setTimeout(() => triggerRef.current?.focus(), 0);
        },
      },
    );
  };

  if (!panelOpen) {
    return (
      <section aria-labelledby="run-gwas-heading">
        <p
          id="run-gwas-heading"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Run GWAS
        </p>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setPanelOpen(true)}
          disabled={sourcesReadyForGwas.length === 0 || coverageBlocked}
          className="mt-2 flex w-full items-center justify-between rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 hover:border-teal-500/40 hover:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          aria-expanded={false}
        >
          <span>
            {coverageBlocked
              ? "GWAS unavailable — endpoint has unresolvable concepts."
              : sourcesReadyForGwas.length === 0
                ? "Generate this endpoint first (no source ready)."
                : "Dispatch a new GWAS run…"}
          </span>
          <ChevronDown size={14} className="text-slate-500" />
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="run-gwas-heading">
      <p
        id="run-gwas-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        Run GWAS
      </p>
      <div className="mt-2 space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        {/* Source picker */}
        <div>
          <label
            htmlFor="run-gwas-source"
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
          >
            Source
          </label>
          <div className="mt-1.5">
            <select
              id="run-gwas-source"
              value={sourceKey}
              onChange={(e) => setSourceKey(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
            >
              <option value="">Pick a source…</option>
              {sourcesReadyForGwas.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
          {sourceKey && !sourcesReadyForGwas.includes(sourceKey) && (
            <p className="mt-2 text-[11px] text-rose-300">
              This endpoint hasn't been generated against {sourceKey} —
              generate first.
            </p>
          )}
        </div>

        {/* Control cohort picker */}
        <div>
          <label
            htmlFor="run-gwas-control"
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
          >
            Control cohort
          </label>
          <div className="mt-1.5">
            <select
              id="run-gwas-control"
              value={controlCohortId ?? ""}
              onChange={(e) => {
                // IN-06: `Number("") === 0`, not NaN, so an empty option must branch
                // explicitly to null; and `Number("0") || null` used to drop legitimate
                // 0 values (matters for the covariate_set_id fallback sentinel below).
                const v = e.target.value;
                if (v === "") { setControlCohortId(null); return; }
                const n = Number(v);
                setControlCohortId(Number.isNaN(n) ? null : n);
              }}
              disabled={!sourceKey || eligibleControls.isLoading}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {eligibleControls.isLoading
                  ? "Loading…"
                  : "Pick a control cohort…"}
              </option>
              {eligibleControls.data?.map((c) => (
                <option
                  key={c.cohort_definition_id}
                  value={c.cohort_definition_id}
                >
                  {c.name} — {c.subject_count.toLocaleString()} subjects
                </option>
              ))}
            </select>
          </div>
          {eligibleControls.data &&
            eligibleControls.data.length === 0 &&
            sourceKey && (
              <p className="mt-2 text-[11px] text-slate-500">
                No eligible control cohorts for {sourceKey}. Generate a
                non-FinnGen cohort first.
              </p>
            )}
        </div>

        {/* Covariates — default chip + Advanced disclosure */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Covariates
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
              <Info size={11} className="text-slate-500" />
              {activeCovariateSet?.name ?? "Default: age + sex + 10 PCs"}
            </span>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="rounded px-1 text-[11px] text-slate-500 hover:text-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
              aria-expanded={advancedOpen}
            >
              Advanced {advancedOpen ? "▴" : "▾"}
            </button>
          </div>
          {advancedOpen && (
            <div className="mt-2 space-y-2">
              <select
                aria-label="Covariate set"
                value={covariateSetId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") { setCovariateSetId(null); return; }
                  const n = Number(v);
                  setCovariateSetId(Number.isNaN(n) ? null : n);
                }}
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
              >
                {covariateSets.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_default ? "· default" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled
                className="cursor-not-allowed text-[11px] text-slate-600"
                title="Covariate-set CRUD ships in v1.1"
              >
                Create new… (coming soon)
              </button>
            </div>
          )}
        </div>

        {/* Overwrite toggle */}
        <label
          className={`flex items-center gap-2 text-[11px] ${
            overwrite ? "text-rose-300" : "text-slate-500"
          }`}
        >
          <input
            ref={overwriteRef}
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="h-3 w-3 accent-rose-500"
            disabled={dispatch.isPending}
          />
          Overwrite existing run (will supersede prior succeeded run)
        </label>

        {/* Error banner */}
        {refusal && (
          <div
            ref={bannerRef}
            role="alert"
            tabIndex={-1}
            className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300"
          >
            <p>{bannerCopy(refusal)}</p>
            {refusal.error_code === "run_in_flight" &&
              refusal.existing_run_id && (
                <Link
                  to={`/workbench/finngen-analyses?run=${encodeURIComponent(refusal.existing_run_id)}`}
                  className="mt-1 inline-block text-teal-400 hover:text-teal-300"
                >
                  Go to running run →
                </Link>
              )}
            {refusal.error_code === "endpoint_not_materialized" && (
              <a
                href="#gen-history-heading"
                className="mt-1 inline-block text-teal-400 hover:text-teal-300"
              >
                Generate first →
              </a>
            )}
          </div>
        )}

        {/* CTA row */}
        <div className="-mx-4 flex items-center justify-end gap-2 border-t border-slate-800 px-4 pt-2">
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-300"
            disabled={dispatch.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={ctaDisabled}
            className="rounded-md bg-teal-500/90 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            {dispatch.isPending ? "Dispatching…" : "Run GWAS"}
          </button>
        </div>
      </div>
    </section>
  );
}
