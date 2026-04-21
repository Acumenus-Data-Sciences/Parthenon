import { useState, useMemo } from "react";
import { ArrowUpDown, Search, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/formatters";
import type { FeatureResult } from "../types/analysis";
import { useTranslation } from "react-i18next";

interface FeatureComparisonTableProps {
  targetFeatures: FeatureResult[];
  comparatorFeatures?: FeatureResult[];
  targetLabel?: string;
  comparatorLabel?: string;
}

type SortField =
  | "feature_name"
  | "target_count"
  | "target_percent"
  | "comparator_count"
  | "comparator_percent"
  | "smd";
type SortDir = "asc" | "desc";

interface MergedRow {
  feature_name: string;
  category: string;
  target_count: number;
  target_percent: number;
  comparator_count: number;
  comparator_percent: number;
  smd: number | null;
}

interface DomainGroup {
  domain: string;
  rows: MergedRow[];
  meanAbsSmd: number | null;
}

function renderSortableHeader({
  field,
  label,
  className,
  sortField,
  onSort,
}: {
  field: SortField;
  label: string;
  className?: string;
  sortField: SortField;
  onSort: (field: SortField) => void;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none",
        className,
      )}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={10}
          className={
            sortField === field ? "text-success" : "text-text-ghost"
          }
        />
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Domain classification
// ---------------------------------------------------------------------------

const DOMAIN_ORDER = [
  "Demographics",
  "Conditions",
  "Drugs",
  "Procedures",
  "Measurements",
  "Visits",
  "Other",
];

function classifyDomain(category: string, featureName: string): string {
  const catLower = (category ?? "").toLowerCase();
  const nameLower = (featureName ?? "").toLowerCase();

  if (catLower === "demographics" || catLower === "demographic") return "Demographics";
  if (catLower === "conditions" || catLower === "condition") return "Conditions";
  if (catLower === "drugs" || catLower === "drug" || catLower === "medication") return "Drugs";
  if (catLower === "procedures" || catLower === "procedure") return "Procedures";
  if (catLower === "measurements" || catLower === "measurement") return "Measurements";
  if (catLower === "visits" || catLower === "visit") return "Visits";

  // Fallback: try to infer from feature name
  if (nameLower.includes("age") || nameLower.includes("gender") || nameLower.includes("sex") || nameLower.includes("race") || nameLower.includes("ethnicity")) return "Demographics";
  if (nameLower.includes("condition") || nameLower.includes("diagnosis")) return "Conditions";
  if (nameLower.includes("drug") || nameLower.includes("medication")) return "Drugs";
  if (nameLower.includes("procedure")) return "Procedures";
  if (nameLower.includes("measurement") || nameLower.includes("lab")) return "Measurements";
  if (nameLower.includes("visit")) return "Visits";

  return "Other";
}

// ---------------------------------------------------------------------------
// SMD computation
// ---------------------------------------------------------------------------

function computeSMD(p1: number, p2: number): number | null {
  const denom = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / 2);
  if (denom === 0) return null;
  return Math.abs(p1 - p2) / denom;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeatureComparisonTable({
  targetFeatures,
  comparatorFeatures,
  targetLabel = "Target",
  comparatorLabel = "Comparator",
}: FeatureComparisonTableProps) {
  const { t } = useTranslation("app");
  const [sortField, setSortField] = useState<SortField>("target_percent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(
    () => new Set(),
  );

  const hasComparator =
    comparatorFeatures !== undefined && comparatorFeatures.length > 0;

  const mergedRows = useMemo<MergedRow[]>(() => {
    const map = new Map<string, MergedRow>();

    for (const f of targetFeatures ?? []) {
      const featureName = f.feature_name ?? "Unnamed feature";
      map.set(featureName, {
        feature_name: featureName,
        category: f.category ?? "",
        target_count: f.count ?? 0,
        target_percent: f.percent ?? 0,
        comparator_count: 0,
        comparator_percent: 0,
        smd: null,
      });
    }

    if (comparatorFeatures) {
      for (const f of comparatorFeatures) {
        const featureName = f.feature_name ?? "Unnamed feature";
        const existing = map.get(featureName);
        if (existing) {
          existing.comparator_count = f.count ?? 0;
          existing.comparator_percent = f.percent ?? 0;
          existing.smd = computeSMD(
            existing.target_percent / 100,
            (f.percent ?? 0) / 100,
          );
        } else {
          map.set(featureName, {
            feature_name: featureName,
            category: f.category ?? "",
            target_count: 0,
            target_percent: 0,
            comparator_count: f.count ?? 0,
            comparator_percent: f.percent ?? 0,
            smd: null,
          });
        }
      }
    }

    return Array.from(map.values());
  }, [targetFeatures, comparatorFeatures]);

  const filteredAndSorted = useMemo(() => {
    let rows = mergedRows;

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        (r.feature_name ?? "").toLowerCase().includes(q),
      );
    }

    rows = [...rows].sort((a, b) => {
      const getValue = (row: MergedRow): string | number => {
        switch (sortField) {
          case "feature_name":
            return row.feature_name;
          case "target_count":
            return row.target_count;
          case "target_percent":
            return row.target_percent;
          case "comparator_count":
            return row.comparator_count;
          case "comparator_percent":
            return row.comparator_percent;
          case "smd":
            return row.smd ?? -1;
        }
      };
      const aVal = getValue(a);
      const bVal = getValue(b);
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [mergedRows, search, sortField, sortDir]);

  // Group by domain
  const domainGroups = useMemo<DomainGroup[]>(() => {
    const groupMap = new Map<string, MergedRow[]>();

    for (const row of filteredAndSorted) {
      const domain = classifyDomain(row.category, row.feature_name);
      const existing = groupMap.get(domain);
      if (existing) {
        existing.push(row);
      } else {
        groupMap.set(domain, [row]);
      }
    }

    return DOMAIN_ORDER.filter((d) => groupMap.has(d)).map((domain) => {
      const rows = groupMap.get(domain) ?? [];
      const smdValues = rows
        .map((r) => r.smd)
        .filter((v): v is number => v !== null);
      const meanAbsSmd =
        smdValues.length > 0
          ? smdValues.reduce((sum, v) => sum + Math.abs(v), 0) /
            smdValues.length
          : null;

      return { domain, rows, meanAbsSmd };
    });
  }, [filteredAndSorted]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleDomain = (domain: string) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const colSpan = hasComparator ? 6 : 3;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("analyses.auto.filterFeatures_e1716d")}
          className={cn(
            "w-full rounded-lg border border-border-default bg-surface-base pl-9 pr-3 py-2 text-sm",
            "text-text-primary placeholder:text-text-ghost",
            "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
          )}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-overlay">
                {renderSortableHeader({
                  field: "feature_name",
                  label: t("analyses.auto.featureName_ba719b"),
                  className: "text-left",
                  sortField,
                  onSort: handleSort,
                })}
                {renderSortableHeader({
                  field: "target_count",
                  label: `${targetLabel} Count`,
                  className: "text-right",
                  sortField,
                  onSort: handleSort,
                })}
                {renderSortableHeader({
                  field: "target_percent",
                  label: `${targetLabel} %`,
                  className: "text-right",
                  sortField,
                  onSort: handleSort,
                })}
                {hasComparator && (
                  <>
                    {renderSortableHeader({
                      field: "comparator_count",
                      label: `${comparatorLabel} Count`,
                      className: "text-right",
                      sortField,
                      onSort: handleSort,
                    })}
                    {renderSortableHeader({
                      field: "comparator_percent",
                      label: `${comparatorLabel} %`,
                      className: "text-right",
                      sortField,
                      onSort: handleSort,
                    })}
                    {renderSortableHeader({
                      field: "smd",
                      label: "SMD",
                      className: "text-right",
                      sortField,
                      onSort: handleSort,
                    })}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {domainGroups.map((group) => {
                const isCollapsed = collapsedDomains.has(group.domain);
                return (
                  <DomainGroupRows
                    key={group.domain}
                    group={group}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleDomain(group.domain)}
                    hasComparator={hasComparator}
                    colSpan={colSpan}
                  />
                );
              })}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-4 py-8 text-center text-sm text-text-ghost"
                  >
                    {t("analyses.auto.noFeaturesFound_e7843a")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-text-ghost">
        {t("analyses.auto.showing_b4e610")} {filteredAndSorted.length} of {mergedRows.length} features
        {" across "}
        {domainGroups.length} domains
        {hasComparator &&
          " | SMD > 0.1 highlighted orange, > 0.2 highlighted red"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Domain group rows sub-component
// ---------------------------------------------------------------------------

function DomainGroupRows({
  group,
  isCollapsed,
  onToggle,
  hasComparator,
  colSpan,
}: {
  group: DomainGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  hasComparator: boolean;
  colSpan: number;
}) {
  const { t } = useTranslation("app");
  return (
    <>
      {/* Domain header row */}
      <tr
        className="bg-surface-overlay cursor-pointer hover:bg-surface-overlay transition-colors"
        onClick={onToggle}
        data-testid={`domain-group-${group.domain}`}
      >
        <td
          colSpan={colSpan}
          className="px-4 py-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <ChevronRight size={14} className="text-text-ghost" />
              ) : (
                <ChevronDown size={14} className="text-text-ghost" />
              )}
              <span className="text-xs font-semibold text-text-secondary">
                {group.domain}
              </span>
              <span className="text-[10px] text-text-ghost">
                ({group.rows.length} {t("analyses.auto.covariates_c01273")}
              </span>
            </div>
            {hasComparator && group.meanAbsSmd !== null && (
              <span
                className={cn(
                  "font-['IBM_Plex_Mono',monospace] text-[11px] font-medium",
                  group.meanAbsSmd > 0.2
                    ? "text-critical"
                    : group.meanAbsSmd > 0.1
                      ? "text-warning"
                      : "text-text-secondary",
                )}
              >
                {t("analyses.auto.meanSMD_c04a97")} {fmt(group.meanAbsSmd)}
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Data rows */}
      {!isCollapsed &&
        group.rows.map((row, i) => (
          <tr
            key={row.feature_name}
            className={cn(
              "border-t border-border-subtle transition-colors",
              i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
            )}
          >
            <td className="px-4 py-2.5 text-sm text-text-primary pl-10">
              {row.feature_name}
            </td>
            <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary">
              {row.target_count.toLocaleString()}
            </td>
            <td className="px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-2">
                <div className="w-16 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{
                      width: `${Math.min(row.target_percent, 100)}%`,
                    }}
                  />
                </div>
                <span className="font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary w-14 text-right">
                  {fmt(row.target_percent, 1)}%
                </span>
              </div>
            </td>
            {hasComparator && (
              <>
                <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary">
                  {row.comparator_count.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${Math.min(row.comparator_percent, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary w-14 text-right">
                      {fmt(row.comparator_percent, 1)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {row.smd !== null ? (
                    <span
                      className={cn(
                        "font-['IBM_Plex_Mono',monospace] text-sm font-medium",
                        row.smd > 0.2
                          ? "text-critical"
                          : row.smd > 0.1
                            ? "text-warning"
                            : "text-text-secondary",
                      )}
                    >
                      {fmt(row.smd)}
                    </span>
                  ) : (
                    <span className="text-xs text-text-ghost">--</span>
                  )}
                </td>
              </>
            )}
          </tr>
        ))}
    </>
  );
}
