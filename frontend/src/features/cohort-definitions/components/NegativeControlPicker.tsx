import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Search, Check, X, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  suggestNegativeControls,
  validateNegativeControls,
} from "../api/cohortApi";
import type {
  NegativeControlSuggestion,
  NegativeControlValidation,
} from "../types/cohortExpression";

interface NegativeControlPickerProps {
  sourceId: number;
  onSelect?: (conceptIds: number[]) => void;
}

export function NegativeControlPicker({
  sourceId,
  onSelect,
}: NegativeControlPickerProps) {
  const [exposureIds, setExposureIds] = useState("");
  const [excludeIds, setExcludeIds] = useState("");
  const [suggestions, setSuggestions] = useState<NegativeControlSuggestion[]>(
    [],
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [validations, setValidations] = useState<
    Map<number, NegativeControlValidation>
  >(new Map());

  const suggestMutation = useMutation({
    mutationFn: (payload: {
      exposure_concept_ids: number[];
      source_id: number;
      exclude_concept_ids?: number[];
    }) => suggestNegativeControls(payload),
    onSuccess: (data) => {
      setSuggestions(data);
      setSelected(new Set());
      setValidations(new Map());
    },
  });

  const validateMutation = useMutation({
    mutationFn: (payload: {
      exposure_concept_ids: number[];
      candidate_concept_ids: number[];
      source_id: number;
    }) => validateNegativeControls(payload),
    onSuccess: (data) => {
      const map = new Map<number, NegativeControlValidation>();
      for (const v of data) map.set(v.concept_id, v);
      setValidations(map);
    },
  });

  const handleSuggest = () => {
    const ids = exposureIds
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) return;

    const exclude = excludeIds
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    suggestMutation.mutate({
      exposure_concept_ids: ids,
      source_id: sourceId,
      exclude_concept_ids: exclude.length > 0 ? exclude : undefined,
    });
  };

  const handleValidate = () => {
    if (selected.size === 0) return;
    const ids = exposureIds
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) return;

    validateMutation.mutate({
      exposure_concept_ids: ids,
      candidate_concept_ids: Array.from(selected),
      source_id: sourceId,
    });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onSelect?.(Array.from(selected));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#F0EDE8] mb-1">
          Negative Control Outcomes
        </h3>
        <p className="text-xs text-[#8A857D]">
          Find conditions with no known causal relationship to your exposure — used to
          detect residual bias in observational studies
        </p>
      </div>

      {/* Exposure IDs input */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-[#5A5650] font-semibold">
          Exposure Concept IDs (comma-separated)
        </label>
        <input
          type="text"
          value={exposureIds}
          onChange={(e) => setExposureIds(e.target.value)}
          placeholder="e.g. 1118084, 1124300"
          className="w-full px-3 py-2 text-xs rounded-lg border border-[#232328] bg-[#1A1A1E] text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#C9A227]/50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-[#5A5650] font-semibold">
          Exclude Concept IDs (known outcomes, optional)
        </label>
        <input
          type="text"
          value={excludeIds}
          onChange={(e) => setExcludeIds(e.target.value)}
          placeholder="e.g. 4329847"
          className="w-full px-3 py-2 text-xs rounded-lg border border-[#232328] bg-[#1A1A1E] text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#C9A227]/50"
        />
      </div>

      <button
        type="button"
        onClick={handleSuggest}
        disabled={!exposureIds.trim() || suggestMutation.isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
          "bg-[#2DD4BF] text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {suggestMutation.isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Search size={14} />
        )}
        Suggest Negative Controls
      </button>

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A857D]">
              {suggestions.length} candidates — {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={validateMutation.isPending}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium border border-[#C9A227]/30 bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors"
                  >
                    {validateMutation.isPending ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <ShieldAlert size={10} />
                    )}
                    Validate
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF] hover:bg-[#2DD4BF]/20 transition-colors"
                  >
                    <Check size={10} />
                    Confirm ({selected.size})
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#1A1A1E]">
                <tr className="border-b border-[#232328]">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 text-left text-[#5A5650] font-medium">
                    Concept
                  </th>
                  <th className="px-3 py-2 text-right text-[#5A5650] font-medium">
                    Persons
                  </th>
                  <th className="px-3 py-2 text-center text-[#5A5650] font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => {
                  const isSelected = selected.has(s.concept_id);
                  const validation = validations.get(s.concept_id);
                  return (
                    <tr
                      key={s.concept_id}
                      onClick={() => toggleSelect(s.concept_id)}
                      className={cn(
                        "border-b border-[#232328] last:border-b-0 cursor-pointer transition-colors",
                        isSelected
                          ? "bg-[#2DD4BF]/5"
                          : "hover:bg-[#1A1A1E]",
                      )}
                    >
                      <td className="px-3 py-2 text-center">
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center",
                            isSelected
                              ? "border-[#2DD4BF] bg-[#2DD4BF]/20"
                              : "border-[#323238]",
                          )}
                        >
                          {isSelected && (
                            <Check size={10} className="text-[#2DD4BF]" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[#F0EDE8]">
                          {s.concept_name}
                        </span>
                        <span className="ml-2 text-[10px] text-[#C9A227]">
                          {s.concept_id}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                        {s.person_count.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {validation ? (
                          validation.has_relationship ? (
                            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium bg-[#E85A6B]/15 text-[#E85A6B]">
                              <X size={8} /> Related
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
                              <Check size={8} /> Valid
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-[#5A5650]">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {suggestMutation.isError && (
        <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5 p-3">
          <p className="text-xs text-[#E85A6B]">
            {(suggestMutation.error as Error).message}
          </p>
        </div>
      )}
    </div>
  );
}
