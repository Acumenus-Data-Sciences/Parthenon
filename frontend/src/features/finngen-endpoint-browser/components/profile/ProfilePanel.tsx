// Phase 18 (Plan 18-06) — Profile tab container.
// Orchestrates the 3 sub-panels (Survival / Comorbidities / Drug classes),
// auto-dispatches POST /profile when the GET envelope is `needs_compute`
// (D-10 expression-hash invalidation loop), and renders click-through
// navigation breadcrumbs (D-06 single-drawer click-through).
//
// State machine per UI-SPEC §Auto-dispatch + polling:
//   cached       → render the 3 sub-panels
//   needs_compute → auto-fire dispatch (idempotent on the server) + polling
//   ineligible   → single error banner; no sub-panels rendered
//
// aria-live="polite" on the container so screen-readers announce the
// transition from cached → needs_compute → cached when a hash invalidates.
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useEndpointProfile } from "../../hooks/useEndpointProfile";
import { useDispatchEndpointProfile } from "../../hooks/useDispatchEndpointProfile";
import { ComputeProfileCta } from "./ComputeProfileCta";
import { SurvivalPanel } from "./SurvivalPanel";
import { ComorbidityMatrixPanel } from "./ComorbidityMatrixPanel";
import { DrugClassesPanel } from "./DrugClassesPanel";

type ProfilePanelProps = {
  endpointName: string;
  endpointDisplayName: string;
  sourceKey: string;
  // Click-through breadcrumb context (D-06).
  priorEndpointName?: string;
  priorEndpointDisplayName?: string;
};

// UI-SPEC §Error states — error_code → user-facing copy.
const INELIGIBLE_COPY: Record<string, string> = {
  source_ineligible:
    "This source has no death or observation-period data. Endpoint profile cannot be computed.",
  endpoint_not_resolvable:
    "This endpoint has no resolvable concepts. Profile cannot be computed.",
  permission_denied:
    "You don't have permission to compute endpoint profiles. Contact an admin.",
};

export function ProfilePanel({
  endpointName,
  endpointDisplayName,
  sourceKey,
  priorEndpointName,
  priorEndpointDisplayName,
}: ProfilePanelProps) {
  const navigate = useNavigate();
  const profileQuery = useEndpointProfile({
    endpointName,
    sourceKey,
    pollWhileNeedsCompute: true,
  });
  const dispatch = useDispatchEndpointProfile(endpointName);

  const envelope = profileQuery.data;
  const status = envelope?.status;

  // Auto-dispatch when the server reports needs_compute (D-10). Idempotent
  // on the server side via finngen.idempotency middleware (Plan 18-04).
  useEffect(() => {
    if (status === "needs_compute" && !dispatch.isPending) {
      dispatch.mutate({ source_key: sourceKey, min_subjects: 20 });
    }
    // We intentionally exclude `dispatch` from deps to avoid re-firing when
    // the mutation reference changes; status + sourceKey are the actual
    // signals that should trigger a new dispatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sourceKey]);

  const handleNavigateToComorbid = useMemo(
    () => (clickedEndpointName: string) => {
      navigate(
        `?open=${encodeURIComponent(clickedEndpointName)}&tab=profile&source=${encodeURIComponent(sourceKey)}`,
        { state: { fromEndpoint: endpointName } },
      );
    },
    [navigate, sourceKey, endpointName],
  );

  return (
    <section
      aria-label="Endpoint profile"
      aria-live="polite"
      className="space-y-6"
    >
      {priorEndpointName && (
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 rounded text-xs text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-400/40"
        >
          <ArrowLeft size={12} />
          <span className="truncate max-w-[240px]">
            {priorEndpointDisplayName ?? priorEndpointName}
          </span>
        </button>
      )}

      {profileQuery.isLoading && (
        <div role="status" className="text-xs text-slate-500">
          Loading profile…
        </div>
      )}

      {status === "ineligible" && envelope && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{INELIGIBLE_COPY[envelope.error_code] ?? envelope.message}</span>
        </div>
      )}

      {status === "needs_compute" && (
        <ComputeProfileCta state="computing" />
      )}

      {status === "cached" && envelope && (
        <>
          <SurvivalPanel
            summary={envelope.summary}
            kmPoints={envelope.km_points}
            sourceHasDeathData={envelope.meta.source_has_death_data}
            endpointDisplayName={endpointDisplayName}
          />
          <ComorbidityMatrixPanel
            comorbidities={envelope.comorbidities}
            universeSize={envelope.meta.universe_size}
            minSubjects={envelope.meta.min_subjects}
            sourceKey={sourceKey}
            onNavigate={handleNavigateToComorbid}
          />
          <DrugClassesPanel
            drugClasses={envelope.drug_classes}
            sourceHasDrugData={envelope.meta.source_has_drug_data}
          />
          <div className="border-t border-slate-800 pt-2 text-right text-xs text-slate-500">
            Cached {new Date(envelope.summary.computed_at).toLocaleString()}
          </div>
        </>
      )}
    </section>
  );
}
