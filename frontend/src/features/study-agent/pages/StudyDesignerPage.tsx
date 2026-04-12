import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Brain,
  Search,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Target,
  Users,
} from "lucide-react";
import {
  searchPhenotypes,
  recommendPhenotypes,
  splitIntent,
  lintCohort,
  type PhenotypeSearchResult,
  type PhenotypeRecommendation,
  type LintWarning,
} from "../api";

export default function StudyDesignerPage() {
  const [studyIntent, setStudyIntent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "intent" | "search" | "recommend" | "lint"
  >("intent");

  // Intent splitting
  const intentMutation = useMutation({
    mutationFn: (intent: string) => splitIntent(intent),
  });

  // Phenotype search
  const searchMutation = useMutation({
    mutationFn: (query: string) => searchPhenotypes(query),
  });

  // Phenotype recommendation
  const recommendMutation = useMutation({
    mutationFn: (intent: string) => recommendPhenotypes(intent),
  });

  // Cohort lint
  const [lintJson, setLintJson] = useState("");
  const lintMutation = useMutation({
    mutationFn: (json: string) => lintCohort(JSON.parse(json)),
  });

  const handleIntentSubmit = () => {
    if (!studyIntent.trim()) return;
    intentMutation.mutate(studyIntent);
    recommendMutation.mutate(studyIntent);
  };

  const tabs = [
    { id: "intent" as const, label: "Study Intent", icon: Target },
    { id: "search" as const, label: "Phenotype Search", icon: Search },
    { id: "recommend" as const, label: "Recommendations", icon: Sparkles },
    { id: "lint" as const, label: "Cohort Lint", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Study Designer</h1>
          <p className="text-sm text-text-muted">
            AI-assisted study design powered by OHDSI StudyAgent
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-surface-base p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-surface-raised text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Intent Tab */}
      {activeTab === "intent" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Describe Your Study
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              Enter a natural language description of your study. The AI will
              split it into target population and outcome, then recommend
              phenotypes from the OHDSI library.
            </p>
            <textarea
              value={studyIntent}
              onChange={(e) => setStudyIntent(e.target.value)}
              placeholder="e.g., Compare the risk of heart failure in patients newly prescribed SGLT2 inhibitors vs DPP-4 inhibitors among adults with type 2 diabetes..."
              className="w-full rounded-lg border border-border-default bg-surface-raised px-4 py-3 text-text-primary placeholder-text-ghost focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              rows={4}
            />
            <button
              onClick={handleIntentSubmit}
              disabled={!studyIntent.trim() || intentMutation.isPending}
              className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-primary/80 disabled:opacity-50"
            >
              {intentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze Study Intent
            </button>
          </div>

          {/* Intent split results */}
          {intentMutation.data && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border-default bg-surface-base/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-success">
                  <Target className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    Target Population
                  </span>
                </div>
                <p className="text-sm text-text-secondary">
                  {intentMutation.data.target}
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-surface-base/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-accent">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-semibold">Outcome</span>
                </div>
                <p className="text-sm text-text-secondary">
                  {intentMutation.data.outcome}
                </p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendMutation.data && recommendMutation.data.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Recommended Phenotypes
              </h3>
              <div className="space-y-3">
                {recommendMutation.data.map(
                  (rec: PhenotypeRecommendation, i: number) => (
                    <div
                      key={rec.cohortId ?? i}
                      className="flex items-start gap-3 rounded-lg border border-border-default/50 bg-surface-raised/50 p-4 transition-colors hover:border-border-hover"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-text-primary">{rec.name}</div>
                        <p className="mt-1 text-sm text-text-muted">
                          {rec.rationale}
                        </p>
                      </div>
                      <div className="text-xs text-text-ghost">
                        Score: {typeof rec.score === "number" ? rec.score.toFixed(2) : "N/A"}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {recommendMutation.isPending && (
            <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              Finding phenotype recommendations...
            </div>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === "search" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Search Phenotype Library
            </h2>
            <div className="flex gap-3">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  searchQuery.trim() &&
                  searchMutation.mutate(searchQuery)
                }
                placeholder="Search for phenotypes (e.g., type 2 diabetes, heart failure, COPD)..."
                className="flex-1 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-text-primary placeholder-text-ghost focus:border-accent focus:outline-none"
              />
              <button
                onClick={() => searchMutation.mutate(searchQuery)}
                disabled={!searchQuery.trim() || searchMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-surface-accent px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-overlay disabled:opacity-50"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
          </div>

          {searchMutation.data && searchMutation.data.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-base/50">
              <div className="border-b border-border-default px-4 py-3">
                <span className="text-sm font-medium text-text-secondary">
                  {searchMutation.data.length} results found
                </span>
              </div>
              <div className="divide-y divide-border-default">
                {searchMutation.data.map(
                  (result: PhenotypeSearchResult, i: number) => (
                    <div
                      key={result.cohortId ?? i}
                      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised/50"
                    >
                      <div className="text-xs font-mono text-text-ghost">
                        #{result.cohortId}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-text-primary">
                          {result.name}
                        </div>
                        {result.description && (
                          <p className="mt-0.5 truncate text-sm text-text-muted">
                            {result.description}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-text-ghost">
                        {typeof result.score === "number"
                          ? result.score.toFixed(3)
                          : ""}
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-ghost" />
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {searchMutation.data && searchMutation.data.length === 0 && (
            <div className="py-8 text-center text-text-ghost">
              No phenotypes found. Try a different search term.
            </div>
          )}
        </div>
      )}

      {/* Recommend Tab */}
      {activeTab === "recommend" && (
        <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
          <p className="text-sm text-text-muted">
            Enter a study intent on the{" "}
            <button
              onClick={() => setActiveTab("intent")}
              className="text-accent hover:underline"
            >
              Study Intent
            </button>{" "}
            tab to get AI-ranked phenotype recommendations.
          </p>
        </div>
      )}

      {/* Lint Tab */}
      {activeTab === "lint" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Lint Cohort Definition
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              Paste a cohort definition JSON to check for design issues like
              missing washout periods, empty concept sets, and inverted time
              windows.
            </p>
            <textarea
              value={lintJson}
              onChange={(e) => setLintJson(e.target.value)}
              placeholder='{"ConceptSets": [...], "PrimaryCriteria": {...}, ...}'
              className="w-full rounded-lg border border-border-default bg-surface-raised px-4 py-3 font-mono text-sm text-text-primary placeholder-text-ghost focus:border-accent focus:outline-none"
              rows={8}
            />
            <button
              onClick={() => lintMutation.mutate(lintJson)}
              disabled={!lintJson.trim() || lintMutation.isPending}
              className="mt-3 flex items-center gap-2 rounded-lg bg-surface-accent px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-overlay disabled:opacity-50"
            >
              {lintMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              Run Lint
            </button>
          </div>

          {lintMutation.data && (
            <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
              {lintMutation.data.length === 0 ? (
                <div className="flex items-center gap-2 text-success">
                  <span className="text-lg">No issues found</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="mb-3 font-semibold text-text-primary">
                    {lintMutation.data.length} issue
                    {lintMutation.data.length !== 1 ? "s" : ""} found
                  </h3>
                  {lintMutation.data.map((w: LintWarning, i: number) => (
                    <div
                      key={i}
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        w.severity === "error"
                          ? "border-red-800/50 bg-red-900/20 text-red-300"
                          : w.severity === "warning"
                            ? "border-yellow-800/50 bg-yellow-900/20 text-yellow-300"
                            : "border-border-default/50 bg-surface-raised/50 text-text-secondary"
                      }`}
                    >
                      <span className="font-mono text-xs uppercase opacity-70">
                        [{w.severity}]
                      </span>{" "}
                      {w.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {lintMutation.isError && (
            <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-300">
              Failed to lint: Invalid JSON or server error.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
