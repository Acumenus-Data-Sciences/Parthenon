import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Loader2, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuildCohort, useRefineCohort } from "../hooks/useAbbyAi";
import type { AbbyBuildResponse } from "../types/abby";

interface AbbyAiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (expression: Record<string, unknown>) => void;
}

const EXAMPLE_PROMPTS = [
  "Patients with Type 2 diabetes on metformin",
  "New users of ACE inhibitors without prior heart failure",
  "Patients aged 65+ with first hip fracture",
  "Women with breast cancer who received chemotherapy",
];

const MAX_CHARS = 1000;

export function AbbyAiPanel({ isOpen, onClose, onApply }: AbbyAiPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AbbyBuildResponse | null>(null);
  const [showExamples, setShowExamples] = useState(true);
  const [refineMode, setRefineMode] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const buildMutation = useBuildCohort();
  const refineMutation = useRefineCohort();

  const isLoading = buildMutation.isPending || refineMutation.isPending;

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll to results when they arrive
  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const handleBuild = () => {
    if (!prompt.trim() || isLoading) return;
    buildMutation.mutate(
      { prompt: prompt.trim() },
      {
        onSuccess: (data) => {
          setResult(data);
          setShowExamples(false);
          setRefineMode(false);
          setRefinePrompt("");
        },
      },
    );
  };

  const handleRefine = () => {
    if (!refinePrompt.trim() || !result || isLoading) return;
    refineMutation.mutate(
      { expression: result.expression, prompt: refinePrompt.trim() },
      {
        onSuccess: (data) => {
          setResult(data);
          setRefineMode(false);
          setRefinePrompt("");
        },
      },
    );
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
    textareaRef.current?.focus();
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result.expression);
  };

  const handleClose = () => {
    onClose();
  };

  const handleReset = () => {
    setPrompt("");
    setResult(null);
    setShowExamples(true);
    setRefineMode(false);
    setRefinePrompt("");
    buildMutation.reset();
    refineMutation.reset();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={handleClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[480px] max-w-full",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Gradient border wrapper */}
        <div className="h-full bg-gradient-to-b from-success to-[var(--domain-observation)] p-[1px] shadow-[0_0_40px_rgba(45,212,191,0.15)]">
          <div className="h-full bg-surface-base flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-success/20 to-[var(--domain-observation)]/20">
                  <Sparkles size={16} className="text-success" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Abby AI
                  </h2>
                  <p className="text-[10px] text-text-muted">
                    Intelligent Cohort Builder
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {result && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
                  >
                    New query
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Example prompts */}
              {showExamples && !result && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Try an example
                  </p>
                  <div className="space-y-1.5">
                    {EXAMPLE_PROMPTS.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => handleExampleClick(example)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg text-sm",
                          "border border-border-default bg-surface-raised",
                          "text-text-secondary hover:text-text-primary",
                          "hover:border-success/30 hover:bg-success/5",
                          "transition-all group flex items-center gap-2",
                        )}
                      >
                        <ChevronRight
                          size={12}
                          className="text-text-ghost group-hover:text-success transition-colors shrink-0"
                        />
                        <span>{example}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full border-2 border-success/20 border-t-success animate-spin" />
                    <div className="absolute inset-0 rounded-full animate-pulse bg-success/5" />
                  </div>
                  <p className="text-sm text-text-muted">
                    Abby is analyzing your research question
                    <span className="inline-flex ml-0.5">
                      <span className="animate-[bounce_1.4s_infinite_0ms] inline-block">.</span>
                      <span className="animate-[bounce_1.4s_infinite_200ms] inline-block">.</span>
                      <span className="animate-[bounce_1.4s_infinite_400ms] inline-block">.</span>
                    </span>
                  </p>
                </div>
              )}

              {/* Error */}
              {(buildMutation.isError || refineMutation.isError) && (
                <div className="rounded-lg border border-critical/30 bg-critical/5 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-critical mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-critical">
                        Something went wrong
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {(buildMutation.error ?? refineMutation.error)?.message ??
                          "Failed to process your request. Please try again."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {result && !isLoading && (
                <div ref={resultsRef} className="space-y-4">
                  {/* Explanation */}
                  <div className="rounded-lg border border-border-default bg-surface-overlay px-4 py-3">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                      Analysis
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {result.explanation}
                    </p>
                  </div>

                  {/* Concept sets */}
                  {result.concept_sets.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                        Concept Sets ({result.concept_sets.length})
                      </p>
                      <div className="space-y-1.5">
                        {result.concept_sets.map((cs) => (
                          <div
                            key={cs.name}
                            className="flex items-center justify-between px-3 py-2 rounded-lg border border-border-default bg-surface-raised"
                          >
                            <span className="text-sm text-text-primary truncate">
                              {cs.name}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-success/10 text-success shrink-0 ml-2">
                              {cs.concepts.length} concepts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          size={14}
                          className="text-accent mt-0.5 shrink-0"
                        />
                        <div className="space-y-1">
                          {result.warnings.map((warning) => (
                            <p
                              key={warning}
                              className="text-xs text-accent"
                            >
                              {warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleApply}
                      className={cn(
                        "flex-1 inline-flex items-center justify-center gap-1.5",
                        "rounded-lg px-4 py-2.5 text-sm font-medium",
                        "bg-success text-surface-base hover:bg-success",
                        "transition-colors",
                      )}
                    >
                      Apply to Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefineMode(!refineMode)}
                      className={cn(
                        "inline-flex items-center justify-center gap-1.5",
                        "rounded-lg px-4 py-2.5 text-sm font-medium",
                        "border border-border-default bg-surface-raised",
                        "text-text-muted hover:text-text-primary hover:border-success/30",
                        "transition-colors",
                        refineMode && "border-[var(--domain-observation)]/30 text-[var(--domain-observation)]",
                      )}
                    >
                      Refine
                    </button>
                  </div>

                  {/* Refinement input */}
                  {refineMode && (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder="How would you like to modify this cohort?"
                        rows={3}
                        className={cn(
                          "w-full rounded-lg border border-[var(--domain-observation)]/30 bg-surface-raised px-3 py-2.5",
                          "text-sm text-text-primary placeholder:text-text-ghost",
                          "focus:outline-none focus:border-[var(--domain-observation)]/60",
                          "resize-none transition-colors",
                        )}
                      />
                      <button
                        type="button"
                        onClick={handleRefine}
                        disabled={!refinePrompt.trim() || isLoading}
                        className={cn(
                          "w-full inline-flex items-center justify-center gap-1.5",
                          "rounded-lg px-4 py-2 text-sm font-medium",
                          "bg-gradient-to-r from-success to-[var(--domain-observation)]",
                          "text-surface-base hover:opacity-90",
                          "transition-opacity disabled:opacity-40 disabled:cursor-not-allowed",
                        )}
                      >
                        {refineMutation.isPending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        Refine Cohort
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input area — fixed at bottom */}
            <div className="border-t border-border-default px-5 py-4 space-y-2">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) =>
                  setPrompt(e.target.value.slice(0, MAX_CHARS))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleBuild();
                  }
                }}
                placeholder="Describe your target population..."
                rows={3}
                disabled={isLoading}
                className={cn(
                  "w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2.5",
                  "text-sm text-text-primary placeholder:text-text-ghost",
                  "focus:outline-none focus:border-success/40",
                  "resize-none transition-colors",
                  "disabled:opacity-50",
                )}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-ghost">
                  {prompt.length}/{MAX_CHARS}
                </span>
                <button
                  type="button"
                  onClick={handleBuild}
                  disabled={!prompt.trim() || isLoading}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium",
                    "bg-success text-surface-base hover:bg-success",
                    "transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {buildMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Build Cohort
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
