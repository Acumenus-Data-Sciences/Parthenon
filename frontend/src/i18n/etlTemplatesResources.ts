/**
 * i18n resource shell for the ingestion templates feature (Plan 3, Phase 0).
 *
 * Each subsequent component task appends the keys it actually uses;
 * the final consolidation pass (Task 15) audits the full key tree.
 *
 * Structure mirrors the existing `etlAqueductResources` pattern:
 *   - English (`etlTemplatesEn`) is the authoritative source.
 *   - Per-locale entries in `etlTemplatesResources` point at the English tree
 *     so the i18n parity invariant (`locales.test.ts` "shell translation key
 *     parity") is preserved. Localization team supplies real translations in
 *     a follow-up by replacing individual locale entries.
 */

type MessageTree = {
  [key: string]: string | MessageTree;
};

export const etlTemplatesEn: MessageTree = {
  aqueduct: {
    subtabs: {
      mappings: "Mappings",
      templates: "Templates",
      runs: "Runs",
    },
    parameterForm: {
      cancel: "Cancel",
      run: "Run",
      running: "Running...",
      close: "Close",
    },
    templates: {
      empty:
        "No templates available — check the templates service is running",
      error:
        "Failed to load templates. Check that the templates service is running.",
      retry: "Retry",
    },
    status: {
      pending: "Pending",
      queued: "Queued",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    runInspector: {
      noLogs: "No logs yet",
      noArtifacts: "No artifacts produced by this run.",
      versionLabel: "Version",
      cancel: "Cancel run",
      retry: "Retry",
      dag: "DAG",
      logs: "Logs",
      artifacts: "Artifacts",
    },
    runs: {
      backToList: "← Back to runs",
      empty: "No runs match the current filters.",
      pageOf: "Page {{page}} of {{total}}",
      prev: "Prev",
      next: "Next",
      columns: {
        template: "Template",
        version: "Version",
        status: "Status",
        started: "Started",
        duration: "Duration",
        submitted_by: "Submitted by",
      },
    },
  },
};

// Stub kept for the plan's literal contract (referenced in the docs) — empty
// because all non-English locales currently fall through to the English tree
// via the aggregator below.
export const etlTemplatesEs: MessageTree = {};

/**
 * Per-locale aggregator consumed by `resources.ts` via the `appForLocale()`
 * reducer. All locales currently point at the English tree to preserve key
 * parity; the localization team replaces individual entries as translations
 * land.
 */
export const etlTemplatesResources: Record<string, MessageTree> = {
  "en-US": etlTemplatesEn,
  "es-ES": etlTemplatesEn,
  "fr-FR": etlTemplatesEn,
  "de-DE": etlTemplatesEn,
  "pt-BR": etlTemplatesEn,
  "fi-FI": etlTemplatesEn,
  "ja-JP": etlTemplatesEn,
  "zh-Hans": etlTemplatesEn,
  "ko-KR": etlTemplatesEn,
  "hi-IN": etlTemplatesEn,
  ar: etlTemplatesEn,
  "en-XA": etlTemplatesEn,
};
