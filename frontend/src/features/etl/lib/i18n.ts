import type { TFunction } from "i18next";

const AQUEDUCT_STATUS_KEY_MAP: Record<string, string> = {
  draft: "draft",
  in_review: "inReview",
  approved: "approved",
  archived: "archived",
};

const AQUEDUCT_FILTER_KEY_MAP: Record<string, string> = {
  all: "all",
  mapped: "mapped",
  unmapped: "unmapped",
};

const AQUEDUCT_EXPORT_KEY_MAP: Record<string, string> = {
  markdown: "markdown",
  sql: "sql",
  json: "json",
};

const AQUEDUCT_MAPPING_TYPE_KEY_MAP: Record<string, string> = {
  direct: "direct",
  transform: "transform",
  lookup: "lookup",
  constant: "constant",
  concat: "concat",
  expression: "expression",
};

const PROFILER_SCORECARD_KEY_MAP: Record<string, string> = {
  highNull: "highNullColumns",
  nearlyEmpty: "nearlyEmptyColumns",
  lowCardinality: "lowCardinality",
  singleValue: "singleValueColumns",
  emptyTables: "emptyTables",
  pii: "piiColumns",
};

const PROFILER_METRIC_KEY_MAP: Record<string, string> = {
  tables: "tables",
  columns: "columns",
  totalRows: "totalRows",
  scanTime: "scanTime",
  grade: "grade",
};

const PROFILER_SORT_KEY_MAP: Record<string, string> = {
  name: "name",
  rows: "rows",
  columns: "columns",
  grade: "grade",
};

const SCAN_PROGRESS_KEY_MAP: Record<string, string> = {
  tables: "tables",
  columns: "columns",
  rows: "rows",
  elapsed: "elapsed",
};

export function getAqueductStatusLabel(t: TFunction, status: string): string {
  const key = AQUEDUCT_STATUS_KEY_MAP[status];
  return key ? t(`etl.aqueduct.common.statuses.${key}`) : status;
}

export function getAqueductFilterLabel(t: TFunction, filter: string): string {
  const key = AQUEDUCT_FILTER_KEY_MAP[filter];
  return key ? t(`etl.aqueduct.common.filters.${key}`) : filter;
}

export function getAqueductExportFormatLabel(t: TFunction, format: string): string {
  const key = AQUEDUCT_EXPORT_KEY_MAP[format];
  return key ? t(`etl.aqueduct.common.exportFormats.${key}`) : format;
}

export function getAqueductMappingTypeLabel(t: TFunction, mappingType: string): string {
  const key = AQUEDUCT_MAPPING_TYPE_KEY_MAP[mappingType];
  return key ? t(`etl.aqueduct.common.mappingTypes.${key}`) : mappingType;
}

export function getProfilerScorecardCheckLabel(t: TFunction, check: string): string {
  const key = PROFILER_SCORECARD_KEY_MAP[check];
  return key ? t(`etl.profiler.scorecard.checks.${key}`) : check;
}

export function getProfilerMetricLabel(t: TFunction, metric: string): string {
  const key = PROFILER_METRIC_KEY_MAP[metric];
  return key ? t(`etl.profiler.metrics.${key}`) : metric;
}

export function getProfilerSortLabel(t: TFunction, field: string): string {
  const key = PROFILER_SORT_KEY_MAP[field];
  return key ? t(`etl.profiler.sort.${key}`) : field;
}

export function getScanProgressLabel(t: TFunction, label: string): string {
  const key = SCAN_PROGRESS_KEY_MAP[label];
  return key ? t(`etl.profiler.progress.${key}`) : label;
}
