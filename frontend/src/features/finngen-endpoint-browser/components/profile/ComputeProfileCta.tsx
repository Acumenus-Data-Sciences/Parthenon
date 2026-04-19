// Phase 18 (Plan 18-06) — primary teal "Compute profile" CTA + state machine.
//
// In the happy path the auto-dispatch on ProfilePanel mount handles compute
// without the user ever seeing this CTA (per UI-SPEC §Auto-dispatch). This
// component exists for the cold/error/disabled paths:
//   - cold       → user clicks "Compute profile" to manually kick off the dispatch
//   - computing  → spinner + "Computing profile… ~15s" copy
//   - ineligible → disabled CTA + helper copy explaining why
//   - error      → "Try again" button + errorMessage
//
// Uses teal-400/80 → teal-400 hover gradient — same hue as D-07 negative-phi
// heatmap cells for visual consistency across the Profile tab. NOT teal-500
// (would clash with the D-07 scale).
import { AlertTriangle } from "lucide-react";

export type ComputeProfileCtaState = "cold" | "computing" | "ineligible" | "error";

type ComputeProfileCtaProps = {
  state: ComputeProfileCtaState;
  errorMessage?: string;
  onCompute?: () => void;
  onRetry?: () => void;
};

export function ComputeProfileCta({
  state,
  errorMessage,
  onCompute,
  onRetry,
}: ComputeProfileCtaProps) {
  if (state === "computing") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-xs text-teal-200"
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-teal-300 border-t-transparent"
        />
        <span>Computing profile… ~15s</span>
      </div>
    );
  }

  if (state === "ineligible") {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed"
        >
          Compute profile
        </button>
        <p className="text-xs text-slate-500">
          This source has no death or observation-period data. Endpoint
          profile cannot be computed.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-2">
        <div
          role="alert"
          className="flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {errorMessage ??
              "Could not load endpoint profile. Please try again in a moment."}
          </span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-teal-400/80 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
        >
          Try again
        </button>
      </div>
    );
  }

  // cold
  return (
    <button
      type="button"
      onClick={onCompute}
      className="rounded-md bg-teal-400/80 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
    >
      Compute profile
    </button>
  );
}
