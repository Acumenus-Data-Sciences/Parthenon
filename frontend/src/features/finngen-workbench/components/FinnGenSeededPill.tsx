// Phase 16 Plan 16-06 (GENOMICS-13) — workbench session attribution pill.
//
// Reader side of the `session_state.seeded_from` marker. The writer lives at
// `frontend/src/features/finngen-endpoint-browser/hooks/useEndpoints.ts:69-72`
// (`useOpenInWorkbench`), which tags a freshly-created workbench session with
// `{kind: 'finngen-endpoint', endpoint_name: <name>}` when the researcher
// opens a FinnGen endpoint into the workbench.
//
// This pill renders only when that marker is present and well-formed, giving
// researchers a one-click way back to the source endpoint while they iterate
// on the operation tree.
//
// Q5 RESOLVED — endpoint-browser detail drawer deep-link convention:
//   See `frontend/src/features/finngen-endpoint-browser/pages/FinnGenEndpointBrowserPage.tsx:109-116`
//   The drawer reader uses `searchParams.get("endpoint")` — NOT `?open=`.
//   Therefore the pill href is `/workbench/finngen-endpoints?endpoint=<name>`.
//   (Pre-existing `FinnGenGwasResultsPage.tsx:59` uses `?open=` — known stale
//   param; out of scope for 16-06.)
//
// Design tokens per 16-CONTEXT.md §D-15:
//   - crimson #9B1B30 text (Parthenon crimson)
//   - crimson 10% background (rgba(155, 27, 48, 0.10))
//   - gold #C9A227 border, 2px
//   - rounded-full, lucide-react Sparkles icon
//
// Security (16-06 threat model):
//   - T-16-S11 XSS via endpoint_name → rendered as React text node (auto-escaped)
//   - T-16-S1c open redirect → href is same-origin hardcoded prefix, endpoint_name
//     passed through encodeURIComponent, never becomes a standalone URL
//   - T-16-S14 type confusion → isFinnGenEndpointSeed runtime guard returns null
//     on any mismatch (covered by Vitest omit cases)
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

interface FinnGenEndpointSeed {
  kind: "finngen-endpoint";
  endpoint_name: string;
}

export interface FinnGenSeededPillProps {
  seededFrom: unknown;
}

export function FinnGenSeededPill({
  seededFrom,
}: FinnGenSeededPillProps): React.ReactElement | null {
  if (!isFinnGenEndpointSeed(seededFrom)) return null;

  // Q5 RESOLVED — see FinnGenEndpointBrowserPage.tsx:110 → searchParams.get("endpoint").
  const href = `/workbench/finngen-endpoints?endpoint=${encodeURIComponent(
    seededFrom.endpoint_name,
  )}`;

  return (
    <Link
      to={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-medium"
      style={{
        borderColor: "#C9A227", // D-15 Parthenon gold
        backgroundColor: "rgba(155, 27, 48, 0.10)", // D-15 crimson/10
        color: "#9B1B30", // D-15 crimson text
      }}
      aria-label={`Seeded from FinnGen endpoint ${seededFrom.endpoint_name}`}
      data-testid="finngen-seeded-pill"
    >
      <Sparkles size={12} aria-hidden="true" />
      From FinnGen {seededFrom.endpoint_name}
    </Link>
  );
}

function isFinnGenEndpointSeed(v: unknown): v is FinnGenEndpointSeed {
  if (typeof v !== "object" || v === null) return false;
  const rec = v as { kind?: unknown; endpoint_name?: unknown };
  return (
    rec.kind === "finngen-endpoint" &&
    typeof rec.endpoint_name === "string" &&
    rec.endpoint_name.length > 0
  );
}
