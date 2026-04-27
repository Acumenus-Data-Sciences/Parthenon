import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Link } from "react-router-dom";
import { HelpButton } from "@/features/help";
import {
  Brain,
  Search,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { useImportProtocolAsNewStudy } from "@/features/studies/hooks/useStudies";
import { StudyDesignWorkbench } from "@/features/studies/components/StudyDesignWorkbench";
import { ProtocolImportProgress } from "@/features/studies/components/ProtocolImportProgress";
import {
  getProtocolImportPhase,
  useProtocolImportElapsed,
} from "@/features/studies/components/protocolImportProgress";
import type { Study } from "@/features/studies/types/study";
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
  const { t } = useTranslation("app");
  const protocolInputRef = useRef<HTMLInputElement | null>(null);
  const [studyIntent, setStudyIntent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "intent" | "search" | "recommend" | "lint"
  >("intent");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [protocolFileName, setProtocolFileName] = useState<string | null>(null);
  const [protocolImportStartedAt, setProtocolImportStartedAt] = useState<
    number | null
  >(null);
  const [protocolImportCompletedAt, setProtocolImportCompletedAt] = useState<
    number | null
  >(null);
  const [protocolImportFailedAt, setProtocolImportFailedAt] = useState<
    number | null
  >(null);
  const [importedStudy, setImportedStudy] = useState<Study | null>(null);
  const importedStudyPath = importedStudy
    ? `/studies/${importedStudy.slug || importedStudy.id}?tab=design`
    : null;
  const importProtocol = useImportProtocolAsNewStudy();
  const protocolBusy = importProtocol.isPending;
  const protocolError = mutationError(importProtocol.error);
  const protocolImportEndedAt =
    protocolImportCompletedAt ?? protocolImportFailedAt;
  const protocolElapsedSeconds = useProtocolImportElapsed(
    protocolImportStartedAt,
    protocolBusy ? null : protocolImportEndedAt,
  );
  const protocolImportPhase = getProtocolImportPhase({
    isPending: protocolBusy,
    elapsedSeconds: protocolElapsedSeconds,
    completedAt: protocolImportCompletedAt,
    failedAt: protocolImportFailedAt,
  });

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
  const [lintParseError, setLintParseError] = useState<string | null>(null);
  const lintMutation = useMutation({
    mutationFn: (cohortDefinition: Record<string, unknown>) =>
      lintCohort(cohortDefinition),
  });

  const handleIntentSubmit = () => {
    if (!studyIntent.trim()) return;
    intentMutation.mutate(studyIntent);
    recommendMutation.mutate(studyIntent);
  };

  const handleProtocolUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProtocolFileName(file.name);
    setProtocolImportStartedAt(Date.now());
    setProtocolImportCompletedAt(null);
    setProtocolImportFailedAt(null);
    setImportedStudy(null);

    try {
      const result = await importProtocol.mutateAsync({
        file,
      });

      setImportedStudy(result.study);
      setProtocolImportCompletedAt(Date.now());
    } catch {
      setProtocolImportFailedAt(Date.now());
      // React Query exposes the mutation error for the visible error panel.
    }
  };

  const handleLintSubmit = () => {
    lintMutation.reset();
    setLintParseError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(lintJson);
    } catch (error) {
      setLintParseError(
        t("studyAgent.lint.invalidJson", {
          message: error instanceof Error ? error.message : "Invalid JSON",
        }),
      );
      return;
    }

    if (!isPlainRecord(parsed)) {
      setLintParseError(t("studyAgent.lint.invalidJsonRoot"));
      return;
    }

    lintMutation.mutate(parsed);
  };

  const tabs = [
    {
      id: "intent" as const,
      label: t("studyAgent.tabs.intent"),
      icon: Target,
    },
    {
      id: "search" as const,
      label: t("studyAgent.tabs.search"),
      icon: Search,
    },
    {
      id: "recommend" as const,
      label: t("studyAgent.tabs.recommend"),
      icon: Sparkles,
    },
    {
      id: "lint" as const,
      label: t("studyAgent.tabs.lint"),
      icon: AlertTriangle,
    },
  ];

  // a11y: Roving-focus tablist per WAI-ARIA Authoring Practices.
  // ArrowRight/Left WRAP between first and last; Home/End jump to ends.
  // Other keys are ignored so screen-reader virtual cursor keystrokes still pass through.
  const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex === -1) return;

    let nextIndex: number;
    switch (e.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {t("studyAgent.header.title")}
            </h1>
            <p className="text-sm text-text-muted">
              {t("studyAgent.header.subtitle")}
            </p>
          </div>
        </div>
        <HelpButton helpKey="study-designer" />
      </div>

      <div className="rounded-lg border border-border-default bg-surface-base/50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-ghost">
              {t("studyAgent.protocol.newStudy")}
            </label>
            <div className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary">
              {t("studyAgent.protocol.newStudyDescription")}
            </div>
          </div>
          <input
            ref={protocolInputRef}
            type="file"
            accept=".doc,.docx,.pdf,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
            className="sr-only"
            onChange={handleProtocolUpload}
          />
          <button
            type="button"
            onClick={() => protocolInputRef.current?.click()}
            disabled={protocolBusy}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            {protocolBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t("studies.designer.actions.uploadProtocol")}
          </button>
        </div>
        <ProtocolImportProgress
          phase={protocolImportPhase}
          elapsedSeconds={protocolElapsedSeconds}
          fileName={protocolFileName}
          className="mt-3"
        />
        {protocolError && (
          <div className="mt-3 rounded-lg border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
            {protocolError}
          </div>
        )}
      </div>

      {importedStudy ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">
                {t("studyAgent.protocol.importReady")}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t("studyAgent.protocol.importReadyDescription")}
              </p>
            </div>
            {importedStudyPath && (
              <Link
                to={importedStudyPath}
                className="inline-flex items-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success-dark"
              >
                {t("studyAgent.protocol.openFullStudy")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <StudyDesignWorkbench study={importedStudy} />
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div
            role="tablist"
            aria-label={t("studyAgent.tabs.label")}
            onKeyDown={handleTabKeyDown}
            className="flex gap-1 rounded-lg bg-surface-base p-1"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`${tab.id}-tab`}
                aria-controls={`${tab.id}-panel`}
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => {
                  setActiveTab(tab.id);
                  tabRefs.current[index]?.focus();
                }}
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
            <div
              role="tabpanel"
              id="intent-panel"
              aria-labelledby="intent-tab"
              className="space-y-4"
            >
              <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
                <h2 className="mb-3 text-lg font-semibold text-text-primary">
                  {t("studyAgent.intent.title")}
                </h2>
                <p className="mb-4 text-sm text-text-muted">
                  {t("studyAgent.intent.description")}
                </p>
                <textarea
                  value={studyIntent}
                  onChange={(e) => setStudyIntent(e.target.value)}
                  placeholder={t("studyAgent.intent.placeholder")}
                  className="w-full rounded-lg border border-border-default bg-surface-raised px-4 py-3 text-text-primary placeholder-text-ghost focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  rows={4}
                />
                <button
                  onClick={handleIntentSubmit}
                  disabled={!studyIntent.trim() || intentMutation.isPending}
                  className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
                >
                  {intentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {t("studyAgent.intent.analyze")}
                </button>
              </div>

              {/* Intent split results */}
              {intentMutation.data && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border-default bg-surface-base/50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-success">
                      <Target className="h-4 w-4" />
                      <span className="text-sm font-semibold">
                        {t("studyAgent.intent.targetPopulation")}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {intentMutation.data.target}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border-default bg-surface-base/50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-accent">
                      <Users className="h-4 w-4" />
                      <span className="text-sm font-semibold">
                        {t("studyAgent.intent.outcome")}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {intentMutation.data.outcome}
                    </p>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {recommendMutation.data && recommendMutation.data.length > 0 && (
                <RecommendationsList items={recommendMutation.data} t={t} />
              )}

              {recommendMutation.isError && !recommendMutation.isPending && (
                <div
                  className="rounded-lg border border-critical/40 bg-critical/10 p-4 text-sm text-critical"
                  role="alert"
                >
                  {mutationError(recommendMutation.error) ??
                    t("studyAgent.recommendations.failed")}
                </div>
              )}

              {intentMutation.isError && !intentMutation.isPending && (
                <div
                  className="rounded-lg border border-critical/40 bg-critical/10 p-4 text-sm text-critical"
                  role="alert"
                >
                  {mutationError(intentMutation.error) ??
                    t("studyAgent.intent.failed")}
                </div>
              )}

              {recommendMutation.isPending && (
                <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("studyAgent.recommendations.loading")}
                </div>
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === "search" && (
            <div
              role="tabpanel"
              id="search-panel"
              aria-labelledby="search-tab"
              className="space-y-4"
            >
              <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
                <h2 className="mb-3 text-lg font-semibold text-text-primary">
                  {t("studyAgent.search.title")}
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
                    placeholder={t("studyAgent.search.placeholder")}
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
                    {t("studyAgent.search.submit")}
                  </button>
                </div>
              </div>

              {searchMutation.data && searchMutation.data.length > 0 && (
                <div className="rounded-lg border border-border-default bg-surface-base/50">
                  <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="border-b border-border-default px-4 py-3"
                  >
                    <span className="text-sm font-medium text-text-secondary">
                      {t("studyAgent.search.resultsFound", {
                        count: searchMutation.data.length,
                      })}
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
                            {Number.isFinite(result.score)
                              ? result.score!.toFixed(3)
                              : ""}
                          </div>
                          <ChevronRight className="h-4 w-4 text-text-ghost" />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {searchMutation.data && searchMutation.data.length === 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="py-8 text-center text-text-ghost"
                >
                  {t("studyAgent.search.noneFound")}
                </div>
              )}

              {searchMutation.isError && !searchMutation.isPending && (
                <div
                  className="rounded-lg border border-critical/40 bg-critical/10 p-4 text-sm text-critical"
                  role="alert"
                >
                  {mutationError(searchMutation.error) ??
                    t("studyAgent.search.failed")}
                </div>
              )}
            </div>
          )}

          {/* Recommend Tab */}
          {activeTab === "recommend" && (
            <div
              role="tabpanel"
              id="recommend-panel"
              aria-labelledby="recommend-tab"
              className="space-y-4"
            >
              {recommendMutation.isPending && (
                <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("studyAgent.recommendations.loading")}
                </div>
              )}

              {recommendMutation.isError && !recommendMutation.isPending && (
                <div
                  className="rounded-lg border border-critical/40 bg-critical/10 p-4 text-sm text-critical"
                  role="alert"
                >
                  {mutationError(recommendMutation.error) ??
                    t("studyAgent.recommendations.failed")}
                </div>
              )}

              {recommendMutation.data && recommendMutation.data.length > 0 && (
                <RecommendationsList items={recommendMutation.data} t={t} />
              )}

              {!recommendMutation.isPending &&
                !recommendMutation.isError &&
                (!recommendMutation.data ||
                  recommendMutation.data.length === 0) && (
                  <div className="rounded-lg border border-border-default bg-surface-base/50 p-6 text-sm text-text-muted">
                    {t("studyAgent.recommendations.promptPrefix")}{" "}
                    <button
                      onClick={() => setActiveTab("intent")}
                      className="text-accent hover:underline"
                    >
                      {t("studyAgent.tabs.intent")}
                    </button>{" "}
                    {t("studyAgent.recommendations.promptSuffix")}
                  </div>
                )}
            </div>
          )}

          {/* Lint Tab */}
          {activeTab === "lint" && (
            <div
              role="tabpanel"
              id="lint-panel"
              aria-labelledby="lint-tab"
              className="space-y-4"
            >
              <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
                <h2 className="mb-3 text-lg font-semibold text-text-primary">
                  {t("studyAgent.lint.title")}
                </h2>
                <p className="mb-4 text-sm text-text-muted">
                  {t("studyAgent.lint.description")}
                </p>
                <textarea
                  value={lintJson}
                  onChange={(e) => {
                    setLintJson(e.target.value);
                    if (lintParseError) setLintParseError(null);
                  }}
                  placeholder='{"ConceptSets": [...], "PrimaryCriteria": {...}, ...}' /* i18n-exempt: Atlas cohort JSON placeholder uses native schema keys. */
                  className="w-full rounded-lg border border-border-default bg-surface-raised px-4 py-3 font-mono text-sm text-text-primary placeholder-text-ghost focus:border-accent focus:outline-none"
                  rows={8}
                />
                <button
                  onClick={handleLintSubmit}
                  disabled={!lintJson.trim() || lintMutation.isPending}
                  className="mt-3 flex items-center gap-2 rounded-lg bg-surface-accent px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-overlay disabled:opacity-50"
                >
                  {lintMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {t("studyAgent.lint.run")}
                </button>
              </div>

              {lintParseError && (
                <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-300">
                  {lintParseError}
                </div>
              )}

              {lintMutation.data && (
                <div className="rounded-lg border border-border-default bg-surface-base/50 p-6">
                  {lintMutation.data.length === 0 ? (
                    <div className="flex items-center gap-2 text-success">
                      <span className="text-lg">
                        {t("studyAgent.lint.noIssuesFound")}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="mb-3 font-semibold text-text-primary">
                        {t("studyAgent.lint.issuesFound", {
                          count: lintMutation.data.length,
                        })}
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
                <div
                  className="rounded-lg border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-300"
                  role="alert"
                >
                  {mutationError(lintMutation.error) ??
                    t("studyAgent.lint.failed")}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function mutationError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object" && "response" in error) {
    const response = (
      error as { response?: { data?: { message?: string; error?: string } } }
    ).response;
    return response?.data?.message ?? response?.data?.error ?? null;
  }

  return "Study Designer request failed.";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function RecommendationsList({
  items,
  t,
}: {
  items: PhenotypeRecommendation[];
  t: TFunction<"app">;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="rounded-lg border border-border-default bg-surface-base/50 p-6"
    >
      <h3 className="mb-4 text-lg font-semibold text-text-primary">
        {t("studyAgent.recommendations.title")}
      </h3>
      <div className="space-y-3">
        {items.map((rec, i) => (
          <div
            key={rec.cohortId ?? i}
            className="flex items-start gap-3 rounded-lg border border-border-default/50 bg-surface-raised/50 p-4 transition-colors hover:border-border-hover"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-text-primary">{rec.name}</div>
              <p className="mt-1 text-sm text-text-muted">{rec.rationale}</p>
            </div>
            <div className="text-xs text-text-ghost">
              {t("studyAgent.recommendations.score", {
                value: Number.isFinite(rec.score) ? rec.score!.toFixed(2) : "N/A",
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
