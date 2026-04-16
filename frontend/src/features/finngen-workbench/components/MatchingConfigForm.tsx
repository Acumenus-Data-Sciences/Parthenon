// frontend/src/features/finngen-workbench/components/MatchingConfigForm.tsx
import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { MatchCohortPayload } from "../api";
import { CohortPicker } from "./CohortPicker";

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
  cohortNames,
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

  const valid =
    Number.isFinite(primaryNum) &&
    primaryNum > 0 &&
    comparatorNums.length > 0 &&
    comparatorNums.length <= 10 &&
    !comparatorNums.includes(primaryNum);

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
    <div className="space-y-4 rounded-lg border border-border-default bg-surface-raised p-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Primary cohort</label>
        <CohortInput
          value={primary}
          onChange={setPrimary}
          cohortNames={cohortNames}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">Comparator cohorts ({comparatorNums.length}/10)</label>
          <button
            type="button"
            onClick={() => setComparators((cs) => (cs.length >= 10 ? cs : [...cs, ""]))}
            disabled={comparators.length >= 10}
            className="flex items-center gap-1 rounded border border-border-default bg-surface-overlay px-2 py-0.5 text-[10px] text-text-secondary hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={10} /> add
          </button>
        </div>
        {comparators.map((c, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <CohortInput
              value={c}
              onChange={(v) => setComparators((cs) => cs.map((x, i) => (i === idx ? v : x)))}
              cohortNames={cohortNames}
            />
            {comparators.length > 1 && (
              <button
                type="button"
                onClick={() => setComparators((cs) => cs.filter((_, i) => i !== idx))}
                className="text-text-ghost hover:text-error"
                aria-label="Remove comparator"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-text-ghost">Ratio (1:N)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={ratio}
            onChange={(e) => setRatio(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
            className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-text-ghost">Max birth-year diff</label>
          <input
            type="number"
            min={0}
            max={10}
            value={maxYearDiff}
            onChange={(e) => setMaxYearDiff(Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0)))}
            disabled={!matchBirthYear}
            className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input type="checkbox" checked={matchSex} onChange={(e) => setMatchSex(e.target.checked)} />
          Match on sex
        </label>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={matchBirthYear}
            onChange={(e) => setMatchBirthYear(e.target.checked)}
          />
          Match on birth year
        </label>
      </div>

      {!valid && (
        <p className="text-[10px] text-warning">
          Enter a positive primary cohort id and at least one distinct comparator id (≤ 10).
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!valid || loading}
        className={[
          "flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors",
          !valid || loading
            ? "bg-surface-overlay text-text-ghost cursor-not-allowed"
            : "bg-success text-bg-canvas hover:bg-success/90",
        ].join(" ")}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : null}
        Run matching
      </button>
    </div>
  );
}

function CohortInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
  // cohortNames kept in props for backward-compat but unused — CohortPicker
  // resolves names from the backend itself.
  cohortNames?: Record<number, string>;
}) {
  // Reuse the typeahead picker so primary + comparators look identical.
  const cid = parseInt(value, 10);
  return (
    <CohortPicker
      value={Number.isFinite(cid) && cid > 0 ? cid : null}
      onChange={(id) => onChange(id === null ? "" : String(id))}
      compact
    />
  );
}

// Legacy raw input — preserved for tests/data-entry contexts that still use
// the old number-only flow. Unused at runtime; kept here so the file diff is
// minimal and the tests don't break their reach into the form.
function _CohortInputLegacy({
  value,
  onChange,
  cohortNames,
}: {
  value: string;
  onChange: (v: string) => void;
  cohortNames?: Record<number, string>;
}) {
  const cid = parseInt(value, 10);
  const name = Number.isFinite(cid) && cohortNames ? cohortNames[cid] : undefined;
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="cohort id"
        className="w-32 rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
      />
      {name !== undefined && <span className="text-xs text-text-ghost">{name}</span>}
    </div>
  );
}
