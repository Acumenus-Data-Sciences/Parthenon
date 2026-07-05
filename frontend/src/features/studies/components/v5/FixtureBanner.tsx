import { FlaskConical } from "lucide-react";
import { str } from "./narrow";

/**
 * Explicit provenance banner for demonstration-fixture v5 results. The seeder
 * flags every fixture row with `_fixture: true` and a `_provenance` string; this
 * renders that provenance so a clinical reviewer can never mistake the
 * representative numbers for a real v5 execution.
 */
export function FixtureBanner({ data }: { data: Record<string, unknown> }) {
  if (data._fixture !== true) {
    return null;
  }

  const provenance =
    str(data._provenance) ||
    "Representative demonstration data — not a real v5 execution.";

  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
      <FlaskConical size={14} className="mt-0.5 shrink-0" />
      <span>
        <span className="font-semibold uppercase tracking-wide">Demonstration data · </span>
        {provenance}
      </span>
    </div>
  );
}
