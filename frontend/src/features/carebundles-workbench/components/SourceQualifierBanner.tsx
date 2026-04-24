import { AlertTriangle } from "lucide-react";
import type { CareBundleSource } from "../types";

interface Props {
  source: CareBundleSource | null | undefined;
  minPopulation: number;
}

export function SourceQualifierBanner({ source, minPopulation }: Props) {
  if (!source || source.qualifies) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-200"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">Research-only source</div>
        <div className="text-xs text-amber-200/80">
          {source.reason ??
            `Population below the ${minPopulation.toLocaleString()} threshold.`}
          {" "}Quality-measure rates on this source are not statistically adequate for
          reporting. Shown here for exploratory work only.
        </div>
      </div>
    </div>
  );
}
