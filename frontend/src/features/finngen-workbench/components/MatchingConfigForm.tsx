// frontend/src/features/finngen-workbench/components/MatchingConfigForm.tsx
import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { MatchCohortPayload } from "../api";
import { CohortPicker } from "./CohortPicker";
import { Divider, Section, Shell } from "@/components/workbench/primitives";

interface MatchingConfigFormProps {
  sourceKey: string;
  defaultPrimaryCohortId?: number;
  cohortNames?: Record<number, string>;
  loading?: boolean;
  onSubmit: (payload: MatchCohortPayload) => void;
}

export function MatchingConfigForm({
  sourceKey,
  defaultPrimaryCohortId,
  loading,
  onSubmit,
}: MatchingConfigFormProps) {
  const [primary, setPrimary] = useState<string>(
    defaultPrimaryCohortId !== undefined ? String(defaultPrimaryCohortId) : "",
  );
  const [comparators, setComparators] = useState<string[]>([""]);
  const [ratio, setRatio] = useState(1);
  const [matchSex, setMatchSex] = useState(true);
  const [matchBirthYear, setMatchBirthYear] = useState(true);
  const [maxYearDiff, setMaxYearDiff] = useState(1);

  const primaryNum = parseInt(primary, 10);
  const comparatorNums = comparators
    .map((c) => parseInt(c, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  const primaryValid = Number.isFinite(primaryNum) && primaryNum > 0;
  const comparatorsValid =
    comparatorNums.length > 0 &&
    comparatorNums.length <= 10 &&
    !comparatorNums.includes(primaryNum);
  const valid = primaryValid && comparatorsValid;

  function handleSubmit() {
    if (!valid || loading) return;
    onSubmit({
      source_key: sourceKey,
      primary_cohort_id: primaryNum,
      comparator_cohort_ids: comparatorNums,
      ratio,
      match_sex: matchSex,
      match_birth_year: matchBirthYear,
      max_year_difference: maxYearDiff,
    });
  }

  return (
    <Shell
      title="Configure matching"
      subtitle="Match a primary cohort (cases) against one or more comparator cohorts (candidate controls)."
    >
      <div className="space-y-4 p-4">
        <Section label="Cohorts">
          <div className="space-y-1">
            <Label>Primary cohort (cases)</Label>
            <CohortRow value={primary} onChange={setPrimary} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>
                Comparator cohorts{" "}
                <span className="text-text-ghost">({comparatorNums.length}/10)</span>
              </Label>
              <button
                type="button"
                onClick={() =>
                  setComparators((cs) => (cs.length >= 10 ? cs : [...cs, ""]))
                }
                disabled={comparators.length >= 10}
                className="flex items-center gap-1 rounded border border-border-default bg-surface-overlay px-2 py-0.5 text-[10px] text-text-secondary hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={10} /> add
              </button>
            </div>
            <div className="space-y-1.5">
              {comparators.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CohortRow
                    value={c}
                    onChange={(v) =>
                      setComparators((cs) => cs.map((x, i) => (i === idx ? v : x)))
                    }
                  />
                  {comparators.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setComparators((cs) => cs.filter((_, i) => i !== idx))
                      }
                      className="text-text-ghost hover:text-error"
                      aria-label="Remove comparator"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Divider />

        <Section label="Matching criteria">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={matchSex}
              onChange={(e) => setMatchSex(e.target.checked)}
            />
            Match on sex
          </label>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={matchBirthYear}
                onChange={(e) => setMatchBirthYear(e.target.checked)}
              />
              Match on birth year
            </label>
            <div className="flex items-center gap-2 pl-6">
              <label className="text-[10px] uppercase tracking-wide text-text-ghost">
                Max year diff
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={maxYearDiff}
                onChange={(e) =>
                  setMaxYearDiff(
                    Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0)),
                  )
                }
                disabled={!matchBirthYear}
                className="w-16 rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs disabled:opacity-50"
              />
              <span className="text-[10px] text-text-ghost">years</span>
            </div>
          </div>
        </Section>

        <Divider />

        <Section label="Ratio">
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wide text-text-ghost">
              Controls per case
            </label>
            <span className="text-xs font-mono text-text-secondary">1:</span>
            <input
              type="number"
              min={1}
              max={10}
              value={ratio}
              onChange={(e) =>
                setRatio(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))
              }
              className="w-16 rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
            />
          </div>
        </Section>
      </div>

      <footer className="sticky bottom-0 border-t border-border-default bg-surface-raised/95 px-4 py-3 backdrop-blur">
        {!valid && (
          <p className="mb-2 text-[10px] text-warning">
            {!primaryValid
              ? "Pick a primary cohort."
              : comparatorNums.length === 0
              ? "Include at least one comparator cohort."
              : comparatorNums.includes(primaryNum)
              ? "A comparator cannot equal the primary cohort."
              : "Fix the cohort selections above."}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!valid || loading}
          className={[
            "flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors",
            !valid || loading
              ? "cursor-not-allowed bg-surface-overlay text-text-ghost"
              : "bg-success text-bg-canvas hover:bg-success/90",
          ].join(" ")}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : null}
          Run matching
        </button>
      </footer>
    </Shell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-text-secondary">{children}</label>;
}

function CohortRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const cid = parseInt(value, 10);
  return (
    <CohortPicker
      value={Number.isFinite(cid) && cid > 0 ? cid : null}
      onChange={(id) => onChange(id === null ? "" : String(id))}
      compact
    />
  );
}
