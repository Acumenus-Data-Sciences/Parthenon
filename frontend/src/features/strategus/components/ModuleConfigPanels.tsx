// ---------------------------------------------------------------------------
// Strategus Module Configuration Panels
// Per-module settings forms for all 8 Strategus modules
// ---------------------------------------------------------------------------

import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import type {
  ModuleSettings,
  ModuleSettingsMap,
  SharedCohortRef,
  CohortMethodSettings,
  PatientLevelPredictionSettings,
  SelfControlledCaseSeriesSettings,
  CohortDiagnosticsSettings,
  CharacterizationSettings,
  CohortIncidenceSettings,
  EvidenceSynthesisSettings,
} from "../types";
import { KNOWN_MODULES } from "../types";

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
      {children}
    </h4>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm text-text-secondary">{children}</label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-success" : "bg-surface-elevated",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[3px]",
          ].join(" ")}
        />
      </button>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

function CohortMultiSelect({
  label,
  selectedIds,
  onChange,
  cohorts,
  filterRole,
}: {
  label: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  cohorts: SharedCohortRef[];
  filterRole?: SharedCohortRef["role"];
}) {
  const filtered = filterRole
    ? cohorts.filter((c) => c.role === filterRole)
    : cohorts;

  const toggleId = (id: number) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {filtered.length === 0 ? (
        <p className="text-xs text-text-ghost">
          No {filterRole ?? ""} cohorts available. Add cohorts in the Shared
          Cohorts step.
        </p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((c) => {
            const isChecked = selectedIds.includes(c.cohortId);
            return (
              <label
                key={c.cohortId}
                className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border-default bg-surface-overlay px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleId(c.cohortId)}
                  className="h-3.5 w-3.5 rounded border-text-ghost accent-success"
                />
                <span className="flex-1 text-sm text-text-primary">
                  {c.cohortName}
                </span>
                <span className="rounded border border-border-default px-1.5 py-px text-[10px] font-medium capitalize text-text-muted">
                  {c.role}
                </span>
                <span className="font-mono text-[10px] text-text-ghost">
                  #{c.cohortId}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  target: "text-success",
  comparator: "text-accent",
  outcome: "text-primary",
};

// We reference ROLE_COLORS to keep them discoverable even though not all panels use them
void ROLE_COLORS;

// ---------------------------------------------------------------------------
// Per-module panels
// ---------------------------------------------------------------------------

function CohortMethodPanel({
  settings,
  onChange,
  cohorts,
}: {
  settings: CohortMethodSettings;
  onChange: (s: CohortMethodSettings) => void;
  cohorts: SharedCohortRef[];
}) {
  const update = <K extends keyof CohortMethodSettings>(
    key: K,
    value: CohortMethodSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <SectionLabel>Cohort Assignment</SectionLabel>
      <CohortMultiSelect
        label="Target Cohorts"
        selectedIds={settings.targetCohortIds}
        onChange={(ids) => update("targetCohortIds", ids)}
        cohorts={cohorts}
        filterRole="target"
      />
      <CohortMultiSelect
        label="Comparator Cohorts"
        selectedIds={settings.comparatorCohortIds}
        onChange={(ids) => update("comparatorCohortIds", ids)}
        cohorts={cohorts}
        filterRole="comparator"
      />
      <CohortMultiSelect
        label="Outcome Cohorts"
        selectedIds={settings.outcomeCohortIds}
        onChange={(ids) => update("outcomeCohortIds", ids)}
        cohorts={cohorts}
        filterRole="outcome"
      />

      <SectionLabel>Parameters</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Washout Period (days)</FieldLabel>
          <NumberInput
            value={settings.washoutPeriod}
            onChange={(v) => update("washoutPeriod", v)}
            min={0}
            max={9999}
          />
        </div>
        <div>
          <FieldLabel>Max Cohort Size (0 = unlimited)</FieldLabel>
          <NumberInput
            value={settings.maxCohortSize}
            onChange={(v) => update("maxCohortSize", v)}
            min={0}
          />
        </div>
      </div>

      <SectionLabel>Covariate Settings</SectionLabel>
      <div className="space-y-2">
        <Toggle
          label="Demographics"
          checked={settings.covariateSettings.useDemographics}
          onChange={(v) =>
            update("covariateSettings", {
              ...settings.covariateSettings,
              useDemographics: v,
            })
          }
        />
        <Toggle
          label="Condition Occurrence"
          checked={settings.covariateSettings.useConditionOccurrence}
          onChange={(v) =>
            update("covariateSettings", {
              ...settings.covariateSettings,
              useConditionOccurrence: v,
            })
          }
        />
        <Toggle
          label="Drug Exposure"
          checked={settings.covariateSettings.useDrugExposure}
          onChange={(v) =>
            update("covariateSettings", {
              ...settings.covariateSettings,
              useDrugExposure: v,
            })
          }
        />
        <Toggle
          label="Procedure Occurrence"
          checked={settings.covariateSettings.useProcedureOccurrence}
          onChange={(v) =>
            update("covariateSettings", {
              ...settings.covariateSettings,
              useProcedureOccurrence: v,
            })
          }
        />
        <Toggle
          label="Measurement"
          checked={settings.covariateSettings.useMeasurement}
          onChange={(v) =>
            update("covariateSettings", {
              ...settings.covariateSettings,
              useMeasurement: v,
            })
          }
        />
      </div>
    </div>
  );
}

function PLPPanel({
  settings,
  onChange,
  cohorts,
}: {
  settings: PatientLevelPredictionSettings;
  onChange: (s: PatientLevelPredictionSettings) => void;
  cohorts: SharedCohortRef[];
}) {
  const update = <K extends keyof PatientLevelPredictionSettings>(
    key: K,
    value: PatientLevelPredictionSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <SectionLabel>Cohort Assignment</SectionLabel>
      <CohortMultiSelect
        label="Target Cohorts"
        selectedIds={settings.targetCohortIds}
        onChange={(ids) => update("targetCohortIds", ids)}
        cohorts={cohorts}
        filterRole="target"
      />
      <CohortMultiSelect
        label="Outcome Cohorts"
        selectedIds={settings.outcomeCohortIds}
        onChange={(ids) => update("outcomeCohortIds", ids)}
        cohorts={cohorts}
        filterRole="outcome"
      />

      <SectionLabel>Model Configuration</SectionLabel>
      <div>
        <FieldLabel>Model Type</FieldLabel>
        <select
          value={settings.modelType}
          onChange={(e) =>
            update(
              "modelType",
              e.target.value as PatientLevelPredictionSettings["modelType"],
            )
          }
          className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="lassoLogistic">Lasso Logistic Regression</option>
          <option value="gradientBoosting">Gradient Boosting</option>
          <option value="randomForest">Random Forest</option>
          <option value="deepLearning">Deep Learning</option>
        </select>
      </div>

      <SectionLabel>Time at Risk</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Window Start (days)</FieldLabel>
          <NumberInput
            value={settings.timeAtRisk.riskWindowStart}
            onChange={(v) =>
              update("timeAtRisk", { ...settings.timeAtRisk, riskWindowStart: v })
            }
            min={0}
          />
        </div>
        <div>
          <FieldLabel>Window End (days)</FieldLabel>
          <NumberInput
            value={settings.timeAtRisk.riskWindowEnd}
            onChange={(v) =>
              update("timeAtRisk", { ...settings.timeAtRisk, riskWindowEnd: v })
            }
            min={1}
          />
        </div>
      </div>

      <SectionLabel>Training Parameters</SectionLabel>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <FieldLabel>Min Cohort Size</FieldLabel>
          <NumberInput
            value={settings.minCohortSize}
            onChange={(v) => update("minCohortSize", v)}
            min={1}
          />
        </div>
        <div>
          <FieldLabel>Split Seed</FieldLabel>
          <NumberInput
            value={settings.splitSeed}
            onChange={(v) => update("splitSeed", v)}
            min={1}
          />
        </div>
        <div>
          <FieldLabel>Test Fraction</FieldLabel>
          <NumberInput
            value={settings.testFraction}
            onChange={(v) => update("testFraction", v)}
            min={0.01}
            max={0.99}
            step={0.05}
          />
        </div>
      </div>
    </div>
  );
}

function SCCSPanel({
  settings,
  onChange,
  cohorts,
}: {
  settings: SelfControlledCaseSeriesSettings;
  onChange: (s: SelfControlledCaseSeriesSettings) => void;
  cohorts: SharedCohortRef[];
}) {
  const update = <K extends keyof SelfControlledCaseSeriesSettings>(
    key: K,
    value: SelfControlledCaseSeriesSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <SectionLabel>Cohort Assignment</SectionLabel>
      <CohortMultiSelect
        label="Outcome Cohorts"
        selectedIds={settings.outcomeCohortIds}
        onChange={(ids) => update("outcomeCohortIds", ids)}
        cohorts={cohorts}
        filterRole="outcome"
      />
      <CohortMultiSelect
        label="Exposure Cohorts"
        selectedIds={settings.exposureCohortIds}
        onChange={(ids) => update("exposureCohortIds", ids)}
        cohorts={cohorts}
      />

      <SectionLabel>Era Covariate Settings</SectionLabel>
      <div className="space-y-2">
        <Toggle
          label="Include Era Overlap"
          checked={settings.eraCovariateSettings.includeEraOverlap}
          onChange={(v) =>
            update("eraCovariateSettings", {
              ...settings.eraCovariateSettings,
              includeEraOverlap: v,
            })
          }
        />
        <Toggle
          label="First Occurrence Only"
          checked={settings.eraCovariateSettings.firstOccurrenceOnly}
          onChange={(v) =>
            update("eraCovariateSettings", {
              ...settings.eraCovariateSettings,
              firstOccurrenceOnly: v,
            })
          }
        />
      </div>
    </div>
  );
}

function CohortDiagnosticsPanel({
  settings,
  onChange,
  cohorts,
}: {
  settings: CohortDiagnosticsSettings;
  onChange: (s: CohortDiagnosticsSettings) => void;
  cohorts: SharedCohortRef[];
}) {
  const update = <K extends keyof CohortDiagnosticsSettings>(
    key: K,
    value: CohortDiagnosticsSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <SectionLabel>Cohort Assignment</SectionLabel>
      <CohortMultiSelect
        label="Target Cohorts"
        selectedIds={settings.targetCohortIds}
        onChange={(ids) => update("targetCohortIds", ids)}
        cohorts={cohorts}
        filterRole="target"
      />

      <SectionLabel>Diagnostics Options</SectionLabel>
      <div className="space-y-2">
        <Toggle
          label="Inclusion Statistics"
          checked={settings.runInclusionStatistics}
          onChange={(v) => update("runInclusionStatistics", v)}
        />
        <Toggle
          label="Incidence Rate"
          checked={settings.runIncidenceRate}
          onChange={(v) => update("runIncidenceRate", v)}
        />
        <Toggle
          label="Time Series"
          checked={settings.runTimeSeries}
          onChange={(v) => update("runTimeSeries", v)}
        />
        <Toggle
          label="Breakdown Index Events"
          checked={settings.runBreakdownIndexEvents}
          onChange={(v) => update("runBreakdownIndexEvents", v)}
        />
        <Toggle
          label="Orphan Concepts"
          checked={settings.runOrphanConcepts}
          onChange={(v) => update("runOrphanConcepts", v)}
        />
      </div>

      <div>
        <FieldLabel>Min Cell Count</FieldLabel>
        <NumberInput
          value={settings.minCellCount}
          onChange={(v) => update("minCellCount", v)}
          min={1}
          max={1000}
        />
      </div>
    </div>
  );
}

function CharacterizationPanel({
  settings,
  onChange,
  cohorts,
}: {
  settings: CharacterizationSettings;
  onChange: (s: CharacterizationSettings) => void;
  cohorts: SharedCohortRef[];
}) {
  const update = <K extends keyof CharacterizationSettings>(
    key: K,
    value: CharacterizationSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <SectionLabel>Cohort Assignment</SectionLabel>
      <CohortMultiSelect
        label="Target Cohorts"
        selectedIds={settings.targetCohortIds}
        onChange={(ids) => update("targetCohortIds", ids)}
        cohorts={cohorts}
        filterRole="target"
      />
      <CohortMultiSelect
        label="Comparator Cohorts"
        selectedIds={settings.comparatorCohortIds}
        onChange={(ids) => update("comparatorCohortIds", ids)}
        cohorts={cohorts}
        filterRole="comparator"
      />

      <SectionLabel>Parameters</SectionLabel>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <FieldLabel>Min Prior Observation (days)</FieldLabel>
          <NumberInput
            value={settings.minPriorObservation}
            onChange={(v) => update("minPriorObservation", v)}
            min={0}
          />
        </div>
        <div>
          <FieldLabel>Dechallenge Stop Interval</FieldLabel>
          <NumberInput
            value={settings.dechallengeStopInterval}
            onChange={(v) => update("dechallengeStopInterval", v)}
            min={0}
          />
        </div>
        <div>
          <FieldLabel>Dechallenge Eval Window</FieldLabel>
          <NumberInput
            value={settings.dechallengeEvaluationWindow}
            onChange={(v) => update("dechallengeEvaluationWindow", v)}
            min={0}
          />
        </div>
      </div>
    </div>
  );
}

function CohortIncidencePanel({
  settings,
  onChange,
  cohorts,
}: {
  settings: CohortIncidenceSettings;
  onChange: (s: CohortIncidenceSettings) => void;
  cohorts: SharedCohortRef[];
}) {
  const update = <K extends keyof CohortIncidenceSettings>(
    key: K,
    value: CohortIncidenceSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <SectionLabel>Cohort Assignment</SectionLabel>
      <CohortMultiSelect
        label="Target Cohorts"
        selectedIds={settings.targetCohortIds}
        onChange={(ids) => update("targetCohortIds", ids)}
        cohorts={cohorts}
        filterRole="target"
      />
      <CohortMultiSelect
        label="Outcome Cohorts"
        selectedIds={settings.outcomeCohortIds}
        onChange={(ids) => update("outcomeCohortIds", ids)}
        cohorts={cohorts}
        filterRole="outcome"
      />

      <SectionLabel>Time at Risk</SectionLabel>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <FieldLabel>Start (days)</FieldLabel>
          <NumberInput
            value={settings.timeAtRiskStart}
            onChange={(v) => update("timeAtRiskStart", v)}
            min={0}
          />
        </div>
        <div>
          <FieldLabel>End (days)</FieldLabel>
          <NumberInput
            value={settings.timeAtRiskEnd}
            onChange={(v) => update("timeAtRiskEnd", v)}
            min={1}
          />
        </div>
        <div>
          <FieldLabel>Clean Window (days)</FieldLabel>
          <NumberInput
            value={settings.cleanWindow}
            onChange={(v) => update("cleanWindow", v)}
            min={0}
          />
        </div>
      </div>
    </div>
  );
}

function EvidenceSynthesisPanel({
  settings,
  onChange,
}: {
  settings: EvidenceSynthesisSettings;
  onChange: (s: EvidenceSynthesisSettings) => void;
}) {
  const update = <K extends keyof EvidenceSynthesisSettings>(
    key: K,
    value: EvidenceSynthesisSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <SectionLabel>Synthesis Configuration</SectionLabel>
      <div>
        <FieldLabel>Method</FieldLabel>
        <select
          value={settings.method}
          onChange={(e) =>
            update("method", e.target.value as EvidenceSynthesisSettings["method"])
          }
          className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="fixedEffects">Fixed Effects</option>
          <option value="randomEffects">Random Effects</option>
          <option value="bayesian">Bayesian</option>
        </select>
      </div>
      <div>
        <FieldLabel>Evidence Source Module</FieldLabel>
        <select
          value={settings.evidenceSynthesisSource}
          onChange={(e) => update("evidenceSynthesisSource", e.target.value)}
          className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="CohortMethod">Cohort Method</option>
          <option value="SelfControlledCaseSeries">
            Self-Controlled Case Series
          </option>
        </select>
      </div>
    </div>
  );
}

function CohortGeneratorPanel() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 px-4 py-3">
      <Info size={15} className="shrink-0 text-success" />
      <p className="text-sm text-text-secondary">
        No configuration needed. CohortGenerator automatically builds cohorts
        from the shared cohort definitions.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public: single-module config panel
// ---------------------------------------------------------------------------

export interface ModuleConfigPanelProps {
  moduleName: string;
  settings: ModuleSettings;
  onChange: (settings: ModuleSettings) => void;
  cohorts: SharedCohortRef[];
}

export function ModuleConfigPanel({
  moduleName,
  settings,
  onChange,
  cohorts,
}: ModuleConfigPanelProps) {
  switch (moduleName) {
    case "CohortMethodModule":
      return (
        <CohortMethodPanel
          settings={settings as CohortMethodSettings}
          onChange={onChange}
          cohorts={cohorts}
        />
      );
    case "PatientLevelPredictionModule":
      return (
        <PLPPanel
          settings={settings as PatientLevelPredictionSettings}
          onChange={onChange}
          cohorts={cohorts}
        />
      );
    case "SelfControlledCaseSeriesModule":
      return (
        <SCCSPanel
          settings={settings as SelfControlledCaseSeriesSettings}
          onChange={onChange}
          cohorts={cohorts}
        />
      );
    case "CohortDiagnosticsModule":
      return (
        <CohortDiagnosticsPanel
          settings={settings as CohortDiagnosticsSettings}
          onChange={onChange}
          cohorts={cohorts}
        />
      );
    case "CharacterizationModule":
      return (
        <CharacterizationPanel
          settings={settings as CharacterizationSettings}
          onChange={onChange}
          cohorts={cohorts}
        />
      );
    case "CohortIncidenceModule":
      return (
        <CohortIncidencePanel
          settings={settings as CohortIncidenceSettings}
          onChange={onChange}
          cohorts={cohorts}
        />
      );
    case "EvidenceSynthesisModule":
      return (
        <EvidenceSynthesisPanel
          settings={settings as EvidenceSynthesisSettings}
          onChange={onChange}
        />
      );
    case "CohortGeneratorModule":
      return <CohortGeneratorPanel />;
    default:
      return (
        <p className="text-sm text-text-ghost">
          Unknown module: {moduleName}
        </p>
      );
  }
}

// ---------------------------------------------------------------------------
// Public: wrapper that renders all selected modules with collapsible panels
// ---------------------------------------------------------------------------

export interface ModuleConfigStepProps {
  selectedModules: string[];
  moduleSettings: ModuleSettingsMap;
  onSettingsChange: (moduleName: string, settings: ModuleSettings) => void;
  cohorts: SharedCohortRef[];
}

export function ModuleConfigStep({
  selectedModules,
  moduleSettings,
  onSettingsChange,
  cohorts,
}: ModuleConfigStepProps) {
  const allModules = ["CohortGeneratorModule", ...selectedModules];
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Expand first non-generator module by default
    const first = selectedModules[0];
    return first ? { [first]: true } : {};
  });

  const toggleExpanded = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          Module Settings
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Configure per-module parameters. Click a module to expand its settings.
        </p>

        <div className="space-y-2">
          {allModules.map((name) => {
            const meta = KNOWN_MODULES.find((km) => km.name === name);
            const isOpen = expanded[name] ?? false;
            const currentSettings = moduleSettings[name] ?? {};

            return (
              <div
                key={name}
                className="rounded-lg border border-border-default bg-surface-base"
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(name)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  {isOpen ? (
                    <ChevronDown size={14} className="text-accent" />
                  ) : (
                    <ChevronRight size={14} className="text-text-ghost" />
                  )}
                  <span className="flex-1 text-sm font-medium text-text-primary">
                    {meta?.label ?? name}
                  </span>
                  {name === "CohortGeneratorModule" && (
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                      Auto
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-border-default px-4 py-4">
                    <ModuleConfigPanel
                      moduleName={name}
                      settings={currentSettings}
                      onChange={(s) => onSettingsChange(name, s)}
                      cohorts={cohorts}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
