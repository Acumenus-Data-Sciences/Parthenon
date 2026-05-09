import { useEffect, useState } from "react";
import { Search, UsersRound, MapPinned } from "lucide-react";
import {
  useCohortGeographyCohorts,
  useCohortGeographyConditions,
  useCohortGeographyCoverage,
} from "../hooks/useGis";
import type {
  CohortGeographyLevel,
  CohortGeographyListItem,
  CohortGeographyMetric,
  CohortGeographyMode,
  CohortGeographySelection,
} from "../types";
import { tAuto } from "@/i18n/autoUserFacing";

interface CohortGeographySelectorProps {
  selection: CohortGeographySelection;
  onChange: (selection: CohortGeographySelection) => void;
}

const SOURCE_ID = 47;

export function CohortGeographySelector({ selection, onChange }: CohortGeographySelectorProps) {
  const [mode, setMode] = useState<CohortGeographyMode>(selection.mode);
  const [search, setSearch] = useState("");
  const coverage = useCohortGeographyCoverage(selection.source_id || SOURCE_ID);
  const cohorts = useCohortGeographyCohorts({
    source_id: selection.source_id || SOURCE_ID,
    search: mode === "generated" ? search || undefined : undefined,
    limit: 8,
  });
  const conditions = useCohortGeographyConditions({
    source_id: selection.source_id || SOURCE_ID,
    search: mode === "condition" ? search || undefined : undefined,
    limit: 8,
  });

  const tractAvailable = coverage.data?.levels.tract.available === true;
  const rows = mode === "generated" ? cohorts.data ?? [] : conditions.data ?? [];

  useEffect(() => {
    if (selection.level === "tract" && coverage.data && !tractAvailable) {
      onChange({ ...selection, level: "county" });
    }
  }, [coverage.data, onChange, selection, tractAvailable]);

  const updateLevel = (level: CohortGeographyLevel) => {
    onChange({ ...selection, source_id: SOURCE_ID, level });
  };

  const updateMetric = (metric: CohortGeographyMetric) => {
    onChange({ ...selection, source_id: SOURCE_ID, metric });
  };

  const selectRow = (item: CohortGeographyListItem) => {
    onChange({
      source_id: SOURCE_ID,
      mode,
      cohort_definition_id: mode === "generated" ? item.cohort_definition_id : undefined,
      concept_id: mode === "condition" ? item.concept_id : undefined,
      label: item.name,
      level: selection.level,
      metric: selection.metric,
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border-default bg-surface-raised p-3">
      <div className="flex items-center gap-2">
        <MapPinned className="h-3.5 w-3.5 text-text-ghost" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
          {/* i18n-exempt: Acumenus PA GIS demo control */}
          Cohort geography
        </span>
      </div>

      <div className="flex overflow-hidden rounded border border-border-default bg-surface-base">
        {(["generated", "condition"] as CohortGeographyMode[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option);
              setSearch("");
            }}
            className={`flex-1 px-2 py-1 text-[10px] ${
              mode === option ? "bg-accent/15 text-accent" : "text-text-ghost hover:text-text-muted"
            }`}
          >
            {option === "generated" ? "Generated" : "Condition"}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-ghost" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={mode === "generated" ? "Search cohorts" : "Search conditions"}
          className="w-full rounded border border-border-default bg-surface-base py-1.5 pl-7 pr-2 text-xs text-text-primary placeholder:text-text-ghost focus:border-accent/50 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-1">
        <select
          value={selection.level}
          onChange={(event) => updateLevel(event.target.value as CohortGeographyLevel)}
          className="rounded border border-border-default bg-surface-base px-2 py-1 text-[11px] text-text-primary focus:border-accent/50 focus:outline-none"
        >
          <option value="county">{tAuto("county_60dee389")}</option>
          <option value="tract" disabled={!tractAvailable}>{tAuto("tract_f2570aa5")}</option>
        </select>
        <select
          value={selection.metric}
          onChange={(event) => updateMetric(event.target.value as CohortGeographyMetric)}
          className="rounded border border-border-default bg-surface-base px-2 py-1 text-[11px] text-text-primary focus:border-accent/50 focus:outline-none"
        >
          <option value="members">{tAuto("members_1cb449c1")}</option>
          <option value="prevalence_per_1000">{tAuto("per1k_9f1252c6")}</option>
        </select>
      </div>

      {selection.label && (
        <p className="line-clamp-2 text-xs font-medium text-accent">{selection.label}</p>
      )}

      <div className="max-h-48 space-y-1 overflow-y-auto">
        {rows.map((item) => {
          const id = mode === "generated" ? item.cohort_definition_id : item.concept_id;
          if (!id) return null;

          const active = mode === selection.mode &&
            (selection.cohort_definition_id === id || selection.concept_id === id);
          return (
            <button
              key={`${mode}-${id}`}
              type="button"
              onClick={() => selectRow(item)}
              className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs ${
                active ? "bg-accent/15 text-accent" : "text-text-muted hover:bg-surface-elevated"
              }`}
            >
              <UsersRound className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.name}</span>
                <span className="block text-[10px] text-text-ghost">
                  {item.geocoded_count.toLocaleString()} {tAuto("mapped_5ec5b5cc")} {item.subject_count.toLocaleString()}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {!tractAvailable && (
        <p className="text-[10px] text-text-ghost">
          {/* i18n-exempt: temporary operational coverage note */}
          Tract maps enable after PA tract geometry is loaded.
        </p>
      )}
    </div>
  );
}
