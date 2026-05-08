import { forwardRef } from "react";
import type { CandidateDetail } from "../types";
import { SimilarityBar } from "./SimilarityBar";
import { tAuto } from "@/i18n/autoUserFacing";

interface CandidateCardProps {
  candidate: CandidateDetail;
  rank: number;
  isFocused: boolean;
  busy: boolean;
  onApprove: (conceptId: number) => void;
  onClick?: () => void;
}

export const CandidateCard = forwardRef<HTMLDivElement, CandidateCardProps>(
  function CandidateCard(
    { candidate, rank, isFocused, busy, onApprove, onClick },
    ref,
  ) {
    const disabled = !candidate.concept_still_valid || busy;
    const focusedRing = isFocused
      ? "ring-2 ring-[#2DD4BF] border-[#2DD4BF]/60"
      : "border-zinc-800";

    return (
      <div
        ref={ref}
        tabIndex={0}
        role="button"
        aria-label={`Candidate ${rank}: ${candidate.concept_name}`}
        aria-pressed={isFocused}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={`relative cursor-pointer rounded-xl border bg-zinc-900/50 p-4 transition focus-visible:outline-none ${focusedRing}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-500">
                #{rank} {tAuto("conceptId_e17d09f7")} {candidate.concept_id}
              </span>
              {candidate.standard_concept !== "S" && (
                <span className="rounded bg-[#9B1B30]/20 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#FCA5A5]">
                  {tAuto("nonStandard_2223c0ad")}
                </span>
              )}
            </div>
            <h3 className="truncate text-base font-semibold text-zinc-100">
              {candidate.concept_name}
            </h3>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {candidate.vocabulary_id}
              </span>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {candidate.domain_id}
              </span>
              {candidate.concept_class_id && (
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {candidate.concept_class_id}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onApprove(candidate.concept_id);
            }}
            disabled={disabled}
            aria-keyshortcuts={isFocused ? "A" : undefined}
            className="shrink-0 rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-[#34E5CF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0E11] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {tAuto("approve_7b2c7f14")}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
              {tAuto("cosineSimilarity_57484e1a")}
            </div>
            <SimilarityBar value={candidate.similarity} />
          </div>
          {candidate.rerank_score !== null && (
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                {tAuto("llmRerankScore_d8783baa")}
              </div>
              <SimilarityBar
                value={candidate.rerank_score}
                ariaLabel={`LLM rerank score ${(candidate.rerank_score * 100).toFixed(1)}%`}
              />
            </div>
          )}
        </div>

        {candidate.rerank_rationale && (
          <blockquote className="mt-3 border-l-2 border-[#C9A227] pl-3 text-sm italic text-zinc-300">
            {candidate.rerank_rationale}
          </blockquote>
        )}

        {!candidate.concept_still_valid && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-[#9B1B30]/50 bg-[#9B1B30]/10 px-3 py-2 text-sm text-[#FCA5A5]"
          >
            {tAuto("thisConceptWasRetiredOrInvalidatedSinceRerank_bfbfb987")}
          </div>
        )}
      </div>
    );
  },
);
