import { useState, useRef } from "react";
import {
  Package,
  ChevronRight,
  ChevronLeft,
  Users,
  BarChart3,
  TrendingUp,
  Activity,
  Stethoscope,
  LineChart,
  Network,
  GitCompare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Upload,
  Download,
  Play,
  Info,
  Plus,
  X,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  useStrategusModules,
  useStrategusValidate,
  useStrategusExecute,
  useStrateagusSources,
} from "../api";
import {
  KNOWN_MODULES,
  type SharedCohortRef,
  type AnalysisSpecification,
  type ModuleSettingsMap,
  getDefaultSettings,
} from "../types";
import { ModuleConfigStep } from "../components/ModuleConfigPanels";
import { JsonSpecEditor } from "../components/JsonSpecEditor";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODULE_ICONS: Record<string, LucideIcon> = {
  Users,
  GitCompare,
  TrendingUp,
  Activity,
  Stethoscope,
  BarChart3,
  LineChart,
  Network,
};

const STEP_LABELS = [
  "Study Info",
  "Select Modules",
  "Shared Cohorts",
  "Module Settings",
  "JSON Preview",
  "Review & Validate",
  "Execute",
];

const ROLE_COLORS: Record<SharedCohortRef["role"], string> = {
  target: "text-success bg-success/10 border-success/30",
  comparator: "text-accent bg-accent/10 border-accent/30",
  outcome: "text-primary bg-primary/10 border-primary/30",
};

function buildSpec(
  selectedModules: string[],
  cohorts: SharedCohortRef[],
  moduleSettings: ModuleSettingsMap = {},
): AnalysisSpecification {
  return {
    sharedResources: {
      cohortDefinitions: cohorts.map((c) => ({
        cohortId: c.cohortId,
        cohortName: c.cohortName,
        json: c.json ?? {},
        sql: c.sql ?? "",
      })),
    },
    moduleSpecifications: selectedModules.map((name) => ({
      module: name,
      settings: (moduleSettings[name] ?? {}) as Record<string, unknown>,
    })),
  };
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

interface StepStudyInfoProps {
  studyName: string;
  studyDescription: string;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
}

function StepStudyInfo({
  studyName,
  studyDescription,
  onNameChange,
  onDescChange,
}: StepStudyInfoProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border-default bg-surface-raised p-6">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Study Information</h2>
        <p className="mb-5 text-sm text-text-muted">
          Name your study package and provide an optional description.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Study Name <span className="text-primary">*</span>
            </label>
            <input
              value={studyName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., SGLT2i vs DPP4i Heart Failure Risk Study"
              className="w-full rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5 text-text-primary placeholder:text-text-ghost transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Description
            </label>
            <textarea
              value={studyDescription}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder="Briefly describe the study objectives, population, and expected outcomes..."
              rows={4}
              className="w-full rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5 text-text-primary placeholder:text-text-ghost transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-raised/60 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-success" />
        <p className="text-sm text-text-muted">
          Strategus executes multi-analysis OHDSI study packages across one or more CDM data
          sources. Each analysis module runs independently and writes results to the configured
          output directory.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface StepSelectModulesProps {
  selectedModules: string[];
  onToggle: (name: string) => void;
  availableModuleNames: Set<string>;
  isLoading: boolean;
}

function StepSelectModules({
  selectedModules,
  onToggle,
  availableModuleNames,
  isLoading,
}: StepSelectModulesProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
        <Loader2 size={18} className="animate-spin" />
        Loading available modules...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Select Analysis Modules</h2>
        <p className="mb-4 text-sm text-text-muted">
          Choose which OHDSI analysis modules to include. CohortGenerator is required and always
          included.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KNOWN_MODULES.map((mod) => {
            const IconComp = MODULE_ICONS[mod.icon] ?? Package;
            const isSelected =
              mod.alwaysIncluded || selectedModules.includes(mod.name);
            const isAvailable = availableModuleNames.size === 0 || availableModuleNames.has(mod.package);
            const isForced = Boolean(mod.alwaysIncluded);

            return (
              <button
                key={mod.name}
                type="button"
                disabled={isForced || !isAvailable}
                onClick={() => !isForced && isAvailable && onToggle(mod.name)}
                className={[
                  "relative flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                  isForced
                    ? "cursor-default border-success/30 bg-success/5"
                    : isSelected
                      ? "cursor-pointer border-accent/40 bg-accent/8 hover:border-accent/60"
                      : isAvailable
                        ? "cursor-pointer border-border-default bg-surface-overlay hover:border-text-ghost"
                        : "cursor-not-allowed border-border-default bg-surface-overlay opacity-40",
                ].join(" ")}
              >
                {/* Checkbox indicator */}
                <div
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded",
                    isForced
                      ? "bg-success/20 text-success"
                      : isSelected
                        ? "bg-accent/20 text-accent"
                        : "border border-text-ghost",
                  ].join(" ")}
                >
                  {(isForced || isSelected) && <Check size={12} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <IconComp size={14} className={isForced ? "text-success" : isSelected ? "text-accent" : "text-text-ghost"} />
                    <span className={`text-sm font-medium ${isSelected || isForced ? "text-text-primary" : "text-text-secondary"}`}>
                      {mod.label}
                    </span>
                    {isForced && (
                      <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-ghost">{mod.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-text-muted">
        <CheckCircle2 size={14} className="text-success" />
        <span>
          {selectedModules.length + 1} module{selectedModules.length !== 0 ? "s" : ""} selected
          (including CohortGenerator)
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface StepSharedCohortsProps {
  cohorts: SharedCohortRef[];
  onAdd: (c: SharedCohortRef) => void;
  onRemove: (cohortId: number) => void;
}

function StepSharedCohorts({ cohorts, onAdd, onRemove }: StepSharedCohortsProps) {
  const [role, setRole] = useState<SharedCohortRef["role"]>("target");
  const [searchTerm, setSearchTerm] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const { data: cohortPage, isLoading } = useQuery({
    queryKey: ["cohort-definitions", { search: searchTerm }],
    queryFn: () => getCohortDefinitions({ search: searchTerm || undefined, limit: 30 }),
    enabled: showPicker,
  });

  const availableCohorts = cohortPage?.items ?? [];
  const assignedIds = new Set(cohorts.map((c) => c.cohortId));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Shared Cohort Definitions</h2>
        <p className="mb-4 text-sm text-text-muted">
          Add target, comparator, and outcome cohorts shared across all analysis modules.
        </p>

        {/* Assigned cohorts */}
        {cohorts.length > 0 && (
          <div className="mb-4 space-y-2">
            {cohorts.map((c) => (
              <div
                key={c.cohortId}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5"
              >
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[c.role]}`}
                >
                  {c.role}
                </span>
                <span className="flex-1 text-sm text-text-primary">{c.cohortName}</span>
                <span className="font-mono text-xs text-text-ghost">#{c.cohortId}</span>
                <button
                  type="button"
                  onClick={() => onRemove(c.cohortId)}
                  className="text-text-ghost transition-colors hover:text-primary"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add cohort controls */}
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as SharedCohortRef["role"])}
            className="rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-secondary focus:border-accent focus:outline-none"
          >
            <option value="target">Target</option>
            <option value="comparator">Comparator</option>
            <option value="outcome">Outcome</option>
          </select>
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <Plus size={14} />
            Add Cohort
          </button>
        </div>

        {/* Cohort picker */}
        {showPicker && (
          <div className="mt-3 rounded-lg border border-border-default bg-surface-base">
            <div className="border-b border-border-default p-3">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search cohort definitions..."
                className="w-full rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  Loading cohorts...
                </div>
              )}
              {!isLoading && availableCohorts.length === 0 && (
                <div className="py-6 text-center text-sm text-text-ghost">
                  No cohort definitions found.
                </div>
              )}
              {availableCohorts.map((cd) => {
                const alreadyAdded = assignedIds.has(cd.id);
                return (
                  <button
                    key={cd.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => {
                      if (!alreadyAdded) {
                        onAdd({
                          cohortId: cd.id,
                          cohortName: cd.name,
                          role,
                          json: (cd.expression_json as object) ?? {},
                          sql: "",
                        });
                        setShowPicker(false);
                        setSearchTerm("");
                      }
                    }}
                    className={[
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      alreadyAdded
                        ? "cursor-default opacity-40"
                        : "hover:bg-surface-overlay",
                    ].join(" ")}
                  >
                    <span className="font-mono text-xs text-text-ghost">#{cd.id}</span>
                    <span className="flex-1 text-sm text-text-primary">{cd.name}</span>
                    {alreadyAdded && (
                      <span className="text-xs text-success">Added</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {cohorts.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-sm text-accent/80">
            No cohorts added yet. Most analysis modules require at least one target cohort.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface StepReviewProps {
  studyName: string;
  studyDescription: string;
  selectedModules: string[];
  cohorts: SharedCohortRef[];
  spec: AnalysisSpecification;
  onValidate: () => void;
  isValidating: boolean;
  validation: import("../types").StrategusValidation | null;
  validationError: string | null;
}

function StepReview({
  studyName,
  studyDescription,
  selectedModules,
  cohorts,
  onValidate,
  isValidating,
  validation,
  validationError,
}: StepReviewProps) {
  const allModules = ["CohortGeneratorModule", ...selectedModules];

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Study Package Summary</h2>

        <div className="space-y-3">
          <SummaryRow label="Study Name" value={studyName || "—"} />
          {studyDescription && (
            <SummaryRow label="Description" value={studyDescription} />
          )}
          <SummaryRow
            label="Modules"
            value={
              <div className="flex flex-wrap gap-1.5 mt-1">
                {allModules.map((m) => {
                  const meta = KNOWN_MODULES.find((km) => km.name === m);
                  return (
                    <span
                      key={m}
                      className="rounded bg-surface-overlay border border-border-default px-2 py-0.5 text-xs text-text-secondary"
                    >
                      {meta?.label ?? m}
                    </span>
                  );
                })}
              </div>
            }
          />
          <SummaryRow
            label="Cohorts"
            value={
              cohorts.length === 0 ? (
                <span className="text-text-ghost">None configured</span>
              ) : (
                <div className="mt-1 space-y-1">
                  {cohorts.map((c) => (
                    <div key={c.cohortId} className="flex items-center gap-2 text-sm">
                      <span
                        className={`rounded border px-1.5 py-px text-[10px] font-medium capitalize ${ROLE_COLORS[c.role]}`}
                      >
                        {c.role}
                      </span>
                      <span className="text-text-secondary">{c.cohortName}</span>
                    </div>
                  ))}
                </div>
              )
            }
          />
        </div>
      </div>

      {/* Validate button */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Validate Specification</h3>
            <p className="mt-0.5 text-xs text-text-muted">
              Check the analysis spec for module configuration issues before executing.
            </p>
          </div>
          <button
            type="button"
            onClick={onValidate}
            disabled={isValidating || !studyName.trim()}
            className="flex items-center gap-2 rounded-lg bg-surface-overlay border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {isValidating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            Run Validation
          </button>
        </div>

        {/* Validation results */}
        {validationError && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center gap-2 text-sm text-primary">
              <XCircle size={14} />
              Validation failed: {validationError}
            </div>
          </div>
        )}

        {validation && (
          <div className="mt-4 space-y-3">
            <div
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
                validation.validation === "passed"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              {validation.validation === "passed" ? (
                <CheckCircle2 size={15} />
              ) : (
                <XCircle size={15} />
              )}
              Validation {validation.validation}
            </div>

            {validation.issues.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Issues
                </p>
                {validation.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-4 py-2.5 text-sm ${
                      issue.severity === "error"
                        ? "border-primary/30 bg-primary/10 text-red-300"
                        : "border-accent/30 bg-accent/10 text-yellow-300"
                    }`}
                  >
                    <span className="font-mono text-xs opacity-70 uppercase">
                      [{issue.severity}] {issue.module}
                    </span>{" "}
                    — {issue.message}
                  </div>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Warnings
                </p>
                {validation.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-yellow-200/80"
                  >
                    <span className="font-mono text-xs opacity-70">{w.module}</span> — {w.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <span className="w-28 shrink-0 text-sm text-text-muted">{label}</span>
      <div className="flex-1 text-sm text-text-primary">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface StepExecuteProps {
  studyName: string;
  onExecute: (sourceId: number) => void;
  isExecuting: boolean;
  result: import("../types").StrategusExecutionResult | null;
  executeError: string | null;
}

function StepExecute({
  studyName,
  onExecute,
  isExecuting,
  result,
  executeError,
}: StepExecuteProps) {
  const { data: sources = [], isLoading: sourcesLoading } = useStrateagusSources();
  const [selectedSourceId, setSelectedSourceId] = useState<number | "">("");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Execute Study Package</h2>
        <p className="mb-5 text-sm text-text-muted">
          Select a CDM data source and execute "{studyName}" across all configured modules.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Target Data Source
            </label>
            {sourcesLoading ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" /> Loading sources...
              </div>
            ) : (
              <select
                value={selectedSourceId}
                onChange={(e) =>
                  setSelectedSourceId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              >
                <option value="">— Select a source —</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.source_name} ({s.source_key})
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedSourceId || isExecuting}
            onClick={() => selectedSourceId && onExecute(Number(selectedSourceId))}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            {isExecuting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} />
            )}
            {isExecuting ? "Executing…" : "Execute Study Package"}
          </button>
        </div>
      </div>

      {/* In-progress indicator */}
      {isExecuting && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-5">
          <div className="flex items-center gap-3 text-accent">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-medium">Study package is running…</span>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Strategus is orchestrating module execution. This may take several minutes depending
            on dataset size and number of modules.
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/60" />
          </div>
        </div>
      )}

      {/* Error */}
      {executeError && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-start gap-2 text-sm text-red-300">
            <XCircle size={15} className="mt-0.5 shrink-0" />
            <span>Execution failed: {executeError}</span>
          </div>
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="rounded-lg border border-success/30 bg-success/8 p-5">
          <div className="mb-4 flex items-center gap-2 text-success">
            <CheckCircle2 size={18} />
            <span className="font-semibold">Execution Complete</span>
            <span className="ml-auto font-mono text-xs text-text-muted">
              {result.elapsed_seconds.toFixed(1)}s
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ResultStat label="Status" value={result.status} accent="teal" />
            <ResultStat label="Modules Run" value={String(result.modules_executed.length)} accent="gold" />
            <ResultStat label="Result Files" value={String(result.result_files)} accent="teal" />
          </div>

          <div className="mt-4">
            <p className="mb-1 text-xs text-text-muted">Output Directory</p>
            <code className="block rounded bg-surface-overlay px-3 py-2 text-xs text-text-secondary break-all">
              {result.output_directory}
            </code>
          </div>

          {result.modules_executed.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-text-muted">Modules Executed</p>
              <div className="flex flex-wrap gap-1.5">
                {result.modules_executed.map((m) => (
                  <span
                    key={m}
                    className="flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-xs text-success"
                  >
                    <Check size={10} />
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "teal" | "gold";
}) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-overlay p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-bold ${
          accent === "teal" ? "text-success" : "text-accent"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function StudyPackagePage() {
  const [step, setStep] = useState(0);

  // Step 1
  const [studyName, setStudyName] = useState("");
  const [studyDescription, setStudyDescription] = useState("");

  // Step 2
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Step 3
  const [cohorts, setCohorts] = useState<SharedCohortRef[]>([]);

  // Step 4 — module settings
  const [moduleSettings, setModuleSettings] = useState<ModuleSettingsMap>({});

  // Step 5 — spec override (when user edits JSON manually)
  const [specOverride, setSpecOverride] = useState<AnalysisSpecification | null>(null);

  // Step 6 — validation
  const [validation, setValidation] =
    useState<import("../types").StrategusValidation | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Step 5 — execution
  const [execResult, setExecResult] =
    useState<import("../types").StrategusExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  // JSON import ref
  const importRef = useRef<HTMLInputElement>(null);

  const { data: serverModules = [], isLoading: modulesLoading } = useStrategusModules();
  const validateMutation = useStrategusValidate();
  const executeMutation = useStrategusExecute();

  const availableModuleNames = new Set(serverModules.map((m) => m.package));

  // ── module toggle
  const toggleModule = (name: string) => {
    setSelectedModules((prev) => {
      const removing = prev.includes(name);
      if (removing) {
        // Remove settings for deselected module
        setModuleSettings((ms) => {
          const { [name]: _, ...rest } = ms;
          void _;
          return rest;
        });
      } else {
        // Initialize default settings for newly selected module
        setModuleSettings((ms) => ({ ...ms, [name]: getDefaultSettings(name) }));
      }
      setSpecOverride(null); // Reset manual edits when modules change
      return removing ? prev.filter((m) => m !== name) : [...prev, name];
    });
  };

  // ── cohort management
  const addCohort = (c: SharedCohortRef) => {
    setCohorts((prev) => [...prev, c]);
    setSpecOverride(null);
  };
  const removeCohort = (cohortId: number) => {
    setCohorts((prev) => prev.filter((c) => c.cohortId !== cohortId));
    setSpecOverride(null);
  };

  // ── build spec helper
  const currentSpec = specOverride ?? buildSpec(selectedModules, cohorts, moduleSettings);

  // ── module settings change handler (also resets spec override)
  const handleModuleSettingsChange = (moduleName: string, settings: import("../types").ModuleSettings) => {
    setModuleSettings((prev) => ({ ...prev, [moduleName]: settings }));
    setSpecOverride(null);
  };

  // ── validate
  const handleValidate = async () => {
    setValidationError(null);
    setValidation(null);
    try {
      const result = await validateMutation.mutateAsync(currentSpec);
      setValidation(result);
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error ? err.message : "Validation request failed",
      );
    }
  };

  // ── execute
  const handleExecute = async (sourceId: number) => {
    setExecError(null);
    setExecResult(null);
    try {
      const result = await executeMutation.mutateAsync({
        sourceId,
        studyName,
        spec: currentSpec,
      });
      setExecResult(result);
    } catch (err: unknown) {
      setExecError(
        err instanceof Error ? err.message : "Execution request failed",
      );
    }
  };

  // ── JSON export
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(currentSpec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${studyName.replace(/\s+/g, "_") || "strategus_spec"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── JSON import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as import("../types").AnalysisSpecification;
        // Restore module selections from spec
        const mods = (parsed.moduleSpecifications ?? [])
          .map((ms) => ms.module)
          .filter((m) => m !== "CohortGeneratorModule");
        setSelectedModules(mods);
        // Restore cohorts
        const cs: SharedCohortRef[] = (
          parsed.sharedResources?.cohortDefinitions ?? []
        ).map((cd) => ({
          cohortId: cd.cohortId,
          cohortName: cd.cohortName,
          role: "target" as const,
          json: cd.json,
          sql: cd.sql,
        }));
        setCohorts(cs);
      } catch {
        // swallow parse errors — malformed JSON
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be re-imported
    e.target.value = "";
  };

  // ── navigation guards
  const canAdvance = () => {
    if (step === 0) return studyName.trim().length > 0;
    if (step === 1) return true; // At minimum CohortGenerator is always included
    return true;
  };

  const goNext = () => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="space-y-6">
      {/* ── Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Study Packages</h1>
            <p className="text-sm text-text-muted">
              Build and execute Strategus multi-analysis OHDSI study packages
            </p>
          </div>
        </div>

        {/* Import / Export */}
        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary transition-colors hover:border-text-ghost hover:text-text-primary"
          >
            <Upload size={14} />
            Import JSON
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary transition-colors hover:border-text-ghost hover:text-text-primary"
          >
            <Download size={14} />
            Export JSON
          </button>
        </div>
      </div>

      {/* ── Step indicator */}
      <div className="flex items-center gap-0">
        {STEP_LABELS.map((label, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={label} className="flex items-center">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={[
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/15 text-text-primary font-medium"
                    : isDone
                      ? "cursor-pointer text-success hover:bg-surface-overlay"
                      : "cursor-default text-text-ghost",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                    isActive
                      ? "bg-primary text-text-primary"
                      : isDone
                        ? "bg-success/20 text-success"
                        : "bg-surface-elevated text-text-ghost",
                  ].join(" ")}
                >
                  {isDone ? <Check size={10} /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEP_LABELS.length - 1 && (
                <ChevronRight
                  size={14}
                  className={isDone ? "text-success/50" : "text-text-disabled"}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step content */}
      <div className="min-h-[400px]">
        {step === 0 && (
          <StepStudyInfo
            studyName={studyName}
            studyDescription={studyDescription}
            onNameChange={setStudyName}
            onDescChange={setStudyDescription}
          />
        )}

        {step === 1 && (
          <StepSelectModules
            selectedModules={selectedModules}
            onToggle={toggleModule}
            availableModuleNames={availableModuleNames}
            isLoading={modulesLoading}
          />
        )}

        {step === 2 && (
          <StepSharedCohorts
            cohorts={cohorts}
            onAdd={addCohort}
            onRemove={removeCohort}
          />
        )}

        {step === 3 && (
          <ModuleConfigStep
            selectedModules={selectedModules}
            moduleSettings={moduleSettings}
            onSettingsChange={handleModuleSettingsChange}
            cohorts={cohorts}
          />
        )}

        {step === 4 && (
          <JsonSpecEditor
            spec={currentSpec}
            onSpecChange={setSpecOverride}
          />
        )}

        {step === 5 && (
          <StepReview
            studyName={studyName}
            studyDescription={studyDescription}
            selectedModules={selectedModules}
            cohorts={cohorts}
            spec={currentSpec}
            onValidate={handleValidate}
            isValidating={validateMutation.isPending}
            validation={validation}
            validationError={validationError}
          />
        )}

        {step === 6 && (
          <StepExecute
            studyName={studyName}
            onExecute={handleExecute}
            isExecuting={executeMutation.isPending}
            result={execResult}
            executeError={execError}
          />
        )}
      </div>

      {/* ── Navigation buttons */}
      <div className="flex items-center justify-between border-t border-border-default pt-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 0}
          className="flex items-center gap-2 rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:border-text-ghost hover:text-text-primary disabled:opacity-30"
        >
          <ChevronLeft size={15} />
          Back
        </button>

        {step < STEP_LABELS.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance()}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-primary/80 disabled:opacity-40"
          >
            Next
            <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
