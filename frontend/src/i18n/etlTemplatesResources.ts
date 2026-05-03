/**
 * i18n resources for the ingestion templates feature (Plan 3, Phase 0).
 *
 * Structure mirrors the existing `etlAqueductResources` pattern:
 *   - English (`etlTemplatesEn`) is the authoritative source.
 *   - Per-locale entries in `etlTemplatesResources` point at the English tree
 *     so the i18n parity invariant (`locales.test.ts` "shell translation key
 *     parity") is preserved. Localization team supplies real translations in
 *     a follow-up by replacing individual locale entries.
 *
 * Task 16 (consolidation): backfilled the full key tree used by all
 * components in Tasks 6-15. The `defaultValue` fallbacks scattered through
 * earlier tasks remain harmless safety nets — these real keys now satisfy
 * them.
 */

type MessageTree = {
  [key: string]: string | MessageTree;
};

export const etlTemplatesEn: MessageTree = {
  aqueduct: {
    subtabs: {
      aria: "Aqueduct sub-tabs",
      mappings: "Mappings",
      templates: "Templates",
      runs: "Runs",
    },
    templates: {
      empty: "No templates available — check the templates service is running",
      error:
        "Failed to load templates. Check that the templates service is running.",
      retry: "Retry",
    },
    runs: {
      empty: "No runs match the current filters.",
      backToList: "← Back to runs",
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
    runInspector: {
      dag: "DAG",
      logs: "Logs",
      artifacts: "Artifacts",
      cancel: "Cancel run",
      retry: "Retry",
      noLogs: "No logs yet",
      noArtifacts: "No artifacts produced by this run.",
      versionLabel: "Version",
    },
    parameterForm: {
      run: "Run",
      running: "Running...",
      cancel: "Cancel",
      close: "Close",
    },
    status: {
      pending: "Pending",
      queued: "Queued",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
  },
};

// Stub kept for the plan's literal contract — empty because all non-English
// locales currently fall through to the English tree via the aggregator below.
// The localization team replaces individual entries when translations land.
export const etlTemplatesEs: MessageTree = {};

/**
 * Per-locale aggregator consumed by `resources.ts` via the `appForLocale()`
 * reducer. All locales currently point at the English tree to preserve key
 * parity (enforced by `locales.test.ts` "shell translation key parity").
 * The localization team replaces individual entries as translations land.
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
