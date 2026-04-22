import type { TFunction } from "i18next";

export function getCodeExplorerTabLabel(t: TFunction, tab: string): string {
  const key = {
    counts: "counts",
    relationships: "relationships",
    hierarchy: "hierarchy",
    report: "report",
    "my-reports": "myReports",
  }[tab];

  return key ? t(`codeExplorer.tabs.${key}`) : tab;
}

export function getHierarchyDirectionLabel(
  t: TFunction,
  direction: string,
): string {
  const key = {
    both: "both",
    up: "ancestorsOnly",
    down: "descendantsOnly",
  }[direction];

  return key ? t(`codeExplorer.hierarchy.${key}`) : direction;
}

export function getCountsGroupingLabel(t: TFunction, groupBy: string): string {
  const key = {
    gender: "gender",
    age_decile: "ageDecile",
  }[groupBy];

  return key ? t(`codeExplorer.counts.${key}`) : groupBy;
}

export function getGenderLabel(t: TFunction, id: number | null): string {
  if (id === 8507) return t("codeExplorer.chart.male");
  if (id === 8532) return t("codeExplorer.chart.female");
  return t("codeExplorer.chart.unknown");
}
