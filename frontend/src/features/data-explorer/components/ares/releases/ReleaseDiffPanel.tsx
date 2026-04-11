import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { ReleaseDiff } from "../../../types/ares";

interface ReleaseDiffPanelProps {
  diff: ReleaseDiff | null;
  isLoading: boolean;
}

function DeltaChip({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#252530] px-2 py-0.5 text-xs text-[#888]">
        <Minus size={10} /> 0{suffix}
      </span>
    );
  }

  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs ${
        isPositive ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
      }`}
    >
      {isPositive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {isPositive ? "+" : ""}{value.toLocaleString()}{suffix}
    </span>
  );
}

export default function ReleaseDiffPanel({ diff, isLoading }: ReleaseDiffPanelProps) {
  if (isLoading) {
    return <div className="py-2 text-xs text-[#555]">Computing diff...</div>;
  }

  if (!diff) return null;

  return (
    <div className="mt-3 rounded-lg border border-[#252530] bg-surface-base p-3">
      <div className="mb-2 text-[11px] font-medium uppercase text-[#666]">Release Diff</div>

      {!diff.has_previous ? (
        <p className="text-xs text-[#888]">Initial release -- no previous data to compare.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-xs">
            <div>
              <span className="text-[#666]">Persons:</span>{" "}
              <DeltaChip value={diff.person_delta} />
            </div>
            <div>
              <span className="text-[#666]">Records:</span>{" "}
              <DeltaChip value={diff.record_delta} />
            </div>
            <div>
              <span className="text-[#666]">DQ Score:</span>{" "}
              <DeltaChip value={diff.dq_score_delta} suffix="%" />
            </div>
            <div>
              <span className="text-[#666]">Unmapped:</span>{" "}
              <DeltaChip value={diff.unmapped_code_delta} />
            </div>
            {diff.vocab_version_changed && (
              <div>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  Vocab updated
                </span>
              </div>
            )}
          </div>

          {Object.keys(diff.domain_deltas).length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] uppercase text-[#555]">Domain deltas:</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {Object.entries(diff.domain_deltas).map(([domain, delta]) => {
                  if (delta === 0) return null;
                  return (
                    <span key={domain} className="text-[10px] text-[#888]">
                      {domain}: <DeltaChip value={delta} />
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {diff.auto_notes && (
        <p className="mt-2 text-[10px] italic text-[#666]">{diff.auto_notes}</p>
      )}
    </div>
  );
}
