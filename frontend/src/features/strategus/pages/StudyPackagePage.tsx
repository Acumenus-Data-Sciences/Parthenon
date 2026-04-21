import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
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
import { useTranslation } from "react-i18next";
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
  type ModuleSettings,
  type ModuleSettingsMap,
  type StrategusExecutionResult,
  type StrategusValidation,
  getDefaultSettings,
} from "../types";
import { ModuleConfigStep } from "../components/ModuleConfigPanels";
import { JsonSpecEditor } from "../components/JsonSpecEditor";
import {
  getStrategusModuleDescription,
  getStrategusModuleLabel,
} from "../lib/i18n";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";

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

const STEP_KEYS = [
  "studyInfo",
  "selectModules",
  "sharedCohorts",
  "moduleSettings",
  "jsonPreview",
  "reviewValidate",
  "execute",
] as const;

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

function getExecutionStatusKey(status: string): "completed" | "running" | "failed" | null {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case "completed":
      return "completed";
    case "running":
      return "running";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

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
  const { t } = useTranslation("app");

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border-default bg-surface-raised p-6">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          {t("strategus.page.studyInfo.title")}
        </h2>
        <p className="mb-5 text-sm text-text-muted">
          {t("strategus.page.studyInfo.intro")}
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              {t("strategus.page.studyInfo.studyName")}{" "}
              <span className="text-primary">*</span>
            </label>
            <input
              value={studyName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("strategus.page.studyInfo.studyNamePlaceholder")}
              className="w-full rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5 text-text-primary placeholder:text-text-ghost transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              {t("strategus.page.studyInfo.description")}
            </label>
            <textarea
              value={studyDescription}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder={t("strategus.page.studyInfo.descriptionPlaceholder")}
              rows={4}
              className="w-full resize-none rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5 text-text-primary placeholder:text-text-ghost transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-raised/60 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-success" />
        <p className="text-sm text-text-muted">
          {t("strategus.page.studyInfo.info")}
        </p>
      </div>
    </div>
  );
}

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
  const { t } = useTranslation("app");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
        <Loader2 size={18} className="animate-spin" />
        {t("strategus.page.selectModules.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          {t("strategus.page.selectModules.title")}
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          {t("strategus.page.selectModules.intro")}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KNOWN_MODULES.map((mod) => {
            const IconComp = MODULE_ICONS[mod.icon] ?? Package;
            const isSelected = mod.alwaysIncluded || selectedModules.includes(mod.name);
            const isAvailable =
              availableModuleNames.size === 0 || availableModuleNames.has(mod.package);
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
                    <IconComp
                      size={14}
                      className={
                        isForced
                          ? "text-success"
                          : isSelected
                            ? "text-accent"
                            : "text-text-ghost"
                      }
                    />
                    <span
                      className={`text-sm font-medium ${
                        isSelected || isForced ? "text-text-primary" : "text-text-secondary"
                      }`}
                    >
                      {getStrategusModuleLabel(t, mod.name)}
                    </span>
                    {isForced && (
                      <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                        {t("strategus.common.required")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-ghost">
                    {getStrategusModuleDescription(t, mod.name)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-text-muted">
        <CheckCircle2 size={14} className="text-success" />
        <span>
          {t("strategus.page.selectModules.selectedSummary", {
            count: selectedModules.length + 1,
          })}
        </span>
      </div>
    </div>
  );
}

interface StepSharedCohortsProps {
  cohorts: SharedCohortRef[];
  onAdd: (c: SharedCohortRef) => void;
  onRemove: (cohortId: number) => void;
}

function StepSharedCohorts({ cohorts, onAdd, onRemove }: StepSharedCohortsProps) {
  const { t } = useTranslation("app");
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
        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          {t("strategus.page.sharedCohorts.title")}
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          {t("strategus.page.sharedCohorts.intro")}
        </p>

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
                  {t(`strategus.page.sharedCohorts.roles.${c.role}`)}
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

        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as SharedCohortRef["role"])}
            className="rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-secondary focus:border-accent focus:outline-none"
          >
            <option value="target">{t("strategus.page.sharedCohorts.roles.target")}</option>
            <option value="comparator">{t("strategus.page.sharedCohorts.roles.comparator")}</option>
            <option value="outcome">{t("strategus.page.sharedCohorts.roles.outcome")}</option>
          </select>
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <Plus size={14} />
            {t("strategus.page.sharedCohorts.addCohort")}
          </button>
        </div>

        {showPicker && (
          <div className="mt-3 rounded-lg border border-border-default bg-surface-base">
            <div className="border-b border-border-default p-3">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("strategus.page.sharedCohorts.searchPlaceholder")}
                className="w-full rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  {t("strategus.page.sharedCohorts.loading")}
                </div>
              )}
              {!isLoading && availableCohorts.length === 0 && (
                <div className="py-6 text-center text-sm text-text-ghost">
                  {t("strategus.page.sharedCohorts.noneFound")}
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
                      <span className="text-xs text-success">
                        {t("strategus.common.added")}
                      </span>
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
            {t("strategus.page.sharedCohorts.empty")}
          </p>
        </div>
      )}
    </div>
  );
}

interface StepReviewProps {
  studyName: string;
  studyDescription: string;
  selectedModules: string[];
  cohorts: SharedCohortRef[];
  onValidate: () => void;
  isValidating: boolean;
  validation: StrategusValidation | null;
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
  const { t } = useTranslation("app");
  const allModules = ["CohortGeneratorModule", ...selectedModules];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          {t("strategus.page.review.title")}
        </h2>

        <div className="space-y-3">
          <SummaryRow
            label={t("strategus.page.review.studyName")}
            value={studyName || "—"}
          />
          {studyDescription && (
            <SummaryRow
              label={t("strategus.page.review.description")}
              value={studyDescription}
            />
          )}
          <SummaryRow
            label={t("strategus.page.review.modules")}
            value={
              <div className="mt-1 flex flex-wrap gap-1.5">
                {allModules.map((moduleName) => (
                  <span
                    key={moduleName}
                    className="rounded border border-border-default bg-surface-overlay px-2 py-0.5 text-xs text-text-secondary"
                  >
                    {getStrategusModuleLabel(t, moduleName)}
                  </span>
                ))}
              </div>
            }
          />
          <SummaryRow
            label={t("strategus.page.review.cohorts")}
            value={
              cohorts.length === 0 ? (
                <span className="text-text-ghost">
                  {t("strategus.common.noneConfigured")}
                </span>
              ) : (
                <div className="mt-1 space-y-1">
                  {cohorts.map((c) => (
                    <div key={c.cohortId} className="flex items-center gap-2 text-sm">
                      <span
                        className={`rounded border px-1.5 py-px text-[10px] font-medium capitalize ${ROLE_COLORS[c.role]}`}
                      >
                        {t(`strategus.page.sharedCohorts.roles.${c.role}`)}
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

      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {t("strategus.page.review.validateTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-text-muted">
              {t("strategus.page.review.validateIntro")}
            </p>
          </div>
          <button
            type="button"
            onClick={onValidate}
            disabled={isValidating || !studyName.trim()}
            className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {isValidating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {t("strategus.page.review.runValidation")}
          </button>
        </div>

        {validationError && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center gap-2 text-sm text-primary">
              <XCircle size={14} />
              {t("strategus.page.review.validationFailedWithMessage", {
                message: validationError,
              })}
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
              {validation.validation === "passed"
                ? t("strategus.page.review.validationPassed")
                : t("strategus.page.review.validationFailed")}
            </div>

            {validation.issues.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {t("strategus.common.issues")}
                </p>
                {validation.issues.map((issue, index) => (
                  <div
                    key={`${issue.module}-${index}`}
                    className={`rounded-lg border px-4 py-2.5 text-sm ${
                      issue.severity === "error"
                        ? "border-primary/30 bg-primary/10 text-red-300"
                        : "border-accent/30 bg-accent/10 text-yellow-300"
                    }`}
                  >
                    <span className="font-mono text-xs uppercase opacity-70">
                      [{t(`strategus.page.review.severity.${issue.severity}`)}]{" "}
                      {getStrategusModuleLabel(t, issue.module)}
                    </span>{" "}
                    - {issue.message}
                  </div>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {t("strategus.common.warnings")}
                </p>
                {validation.warnings.map((warning, index) => (
                  <div
                    key={`${warning.module}-${index}`}
                    className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-yellow-200/80"
                  >
                    <span className="font-mono text-xs opacity-70">
                      {getStrategusModuleLabel(t, warning.module)}
                    </span>{" "}
                    - {warning.message}
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
  value: ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <span className="w-28 shrink-0 text-sm text-text-muted">{label}</span>
      <div className="flex-1 text-sm text-text-primary">{value}</div>
    </div>
  );
}

interface StepExecuteProps {
  studyName: string;
  onExecute: (sourceId: number) => void;
  isExecuting: boolean;
  result: StrategusExecutionResult | null;
  executeError: string | null;
}

function StepExecute({
  studyName,
  onExecute,
  isExecuting,
  result,
  executeError,
}: StepExecuteProps) {
  const { t } = useTranslation("app");
  const { data: sources = [], isLoading: sourcesLoading } = useStrateagusSources();
  const [selectedSourceId, setSelectedSourceId] = useState<number | "">("");

  const statusKey = result ? getExecutionStatusKey(result.status) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-default bg-surface-raised p-5">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          {t("strategus.page.execute.title")}
        </h2>
        <p className="mb-5 text-sm text-text-muted">
          {t("strategus.page.execute.intro", { studyName })}
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              {t("strategus.page.execute.targetDataSource")}
            </label>
            {sourcesLoading ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" />{" "}
                {t("strategus.page.execute.loadingSources")}
              </div>
            ) : (
              <select
                value={selectedSourceId}
                onChange={(e) =>
                  setSelectedSourceId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              >
                <option value="">{t("strategus.page.execute.selectSource")}</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.source_name} ({source.source_key})
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedSourceId || isExecuting}
            onClick={() => selectedSourceId && onExecute(Number(selectedSourceId))}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            {isExecuting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} />
            )}
            {isExecuting
              ? t("strategus.page.execute.executing")
              : t("strategus.page.execute.executeStudyPackage")}
          </button>
        </div>
      </div>

      {isExecuting && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-5">
          <div className="flex items-center gap-3 text-accent">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-medium">
              {t("strategus.page.execute.runningTitle")}
            </span>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {t("strategus.page.execute.runningIntro")}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/60" />
          </div>
        </div>
      )}

      {executeError && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-start gap-2 text-sm text-red-300">
            <XCircle size={15} className="mt-0.5 shrink-0" />
            <span>
              {t("strategus.page.execute.executionFailed", {
                message: executeError,
              })}
            </span>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-success/30 bg-success/8 p-5">
          <div className="mb-4 flex items-center gap-2 text-success">
            <CheckCircle2 size={18} />
            <span className="font-semibold">
              {t("strategus.page.execute.executionComplete")}
            </span>
            <span className="ml-auto font-mono text-xs text-text-muted">
              {result.elapsed_seconds.toFixed(1)}s
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ResultStat
              label={t("strategus.page.execute.resultStats.status")}
              value={
                statusKey
                  ? t(`strategus.page.execute.statusLabels.${statusKey}`)
                  : result.status
              }
              accent="teal"
            />
            <ResultStat
              label={t("strategus.page.execute.resultStats.modulesRun")}
              value={String(result.modules_executed.length)}
              accent="gold"
            />
            <ResultStat
              label={t("strategus.page.execute.resultStats.resultFiles")}
              value={String(result.result_files)}
              accent="teal"
            />
          </div>

          <div className="mt-4">
            <p className="mb-1 text-xs text-text-muted">
              {t("strategus.page.execute.outputDirectory")}
            </p>
            <code className="block break-all rounded bg-surface-overlay px-3 py-2 text-xs text-text-secondary">
              {result.output_directory}
            </code>
          </div>

          {result.modules_executed.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-text-muted">
                {t("strategus.page.execute.modulesExecuted")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.modules_executed.map((moduleName) => (
                  <span
                    key={moduleName}
                    className="flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-xs text-success"
                  >
                    <Check size={10} />
                    {getStrategusModuleLabel(t, moduleName)}
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

export default function StudyPackagePage() {
  const { t } = useTranslation("app");
  const [step, setStep] = useState(0);
  const [studyName, setStudyName] = useState("");
  const [studyDescription, setStudyDescription] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [cohorts, setCohorts] = useState<SharedCohortRef[]>([]);
  const [moduleSettings, setModuleSettings] = useState<ModuleSettingsMap>({});
  const [specOverride, setSpecOverride] = useState<AnalysisSpecification | null>(null);
  const [validation, setValidation] = useState<StrategusValidation | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<StrategusExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const { data: serverModules = [], isLoading: modulesLoading } = useStrategusModules();
  const validateMutation = useStrategusValidate();
  const executeMutation = useStrategusExecute();

  const availableModuleNames = new Set(serverModules.map((module) => module.package));
  const currentSpec = specOverride ?? buildSpec(selectedModules, cohorts, moduleSettings);
  const jsonEditorKey = JSON.stringify(currentSpec);

  const toggleModule = (name: string) => {
    setSelectedModules((prev) => {
      const removing = prev.includes(name);
      if (removing) {
        setModuleSettings((existing) => {
          const { [name]: removedSettings, ...rest } = existing;
          void removedSettings;
          return rest;
        });
      } else {
        setModuleSettings((existing) => ({
          ...existing,
          [name]: getDefaultSettings(name),
        }));
      }
      setSpecOverride(null);
      return removing ? prev.filter((moduleName) => moduleName !== name) : [...prev, name];
    });
  };

  const addCohort = (cohort: SharedCohortRef) => {
    setCohorts((prev) => [...prev, cohort]);
    setSpecOverride(null);
  };

  const removeCohort = (cohortId: number) => {
    setCohorts((prev) => prev.filter((cohort) => cohort.cohortId !== cohortId));
    setSpecOverride(null);
  };

  const handleModuleSettingsChange = (moduleName: string, settings: ModuleSettings) => {
    setModuleSettings((prev) => ({ ...prev, [moduleName]: settings }));
    setSpecOverride(null);
  };

  const handleValidate = async () => {
    setValidationError(null);
    setValidation(null);
    try {
      const result = await validateMutation.mutateAsync(currentSpec);
      setValidation(result);
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error
          ? err.message
          : t("strategus.page.review.validationRequestFailed"),
      );
    }
  };

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
        err instanceof Error
          ? err.message
          : t("strategus.page.execute.executionRequestFailed"),
      );
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(currentSpec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${studyName.replace(/\s+/g, "_") || "strategus_spec"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(
          loadEvent.target?.result as string,
        ) as AnalysisSpecification;
        const restoredModules = (parsed.moduleSpecifications ?? [])
          .map((moduleSpec) => moduleSpec.module)
          .filter((moduleName) => moduleName !== "CohortGeneratorModule");
        setSelectedModules(restoredModules);

        const restoredCohorts: SharedCohortRef[] = (
          parsed.sharedResources?.cohortDefinitions ?? []
        ).map((cohortDefinition) => ({
          cohortId: cohortDefinition.cohortId,
          cohortName: cohortDefinition.cohortName,
          role: "target" as const,
          json: cohortDefinition.json,
          sql: cohortDefinition.sql,
        }));
        setCohorts(restoredCohorts);

        const restoredSettings = Object.fromEntries(
          (parsed.moduleSpecifications ?? []).map((moduleSpec) => [
            moduleSpec.module,
            moduleSpec.settings as ModuleSettings,
          ]),
        ) as ModuleSettingsMap;
        setModuleSettings(restoredSettings);
        setSpecOverride(parsed);
      } catch {
        // Ignore malformed JSON imports.
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const canAdvance = () => {
    if (step === 0) return studyName.trim().length > 0;
    return true;
  };

  const goNext = () => setStep((current) => Math.min(current + 1, STEP_KEYS.length - 1));
  const goPrev = () => setStep((current) => Math.max(current - 1, 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {t("strategus.page.header.title")}
            </h1>
            <p className="text-sm text-text-muted">
              {t("strategus.page.header.subtitle")}
            </p>
          </div>
        </div>

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
            {t("strategus.page.header.importJson")}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary transition-colors hover:border-text-ghost hover:text-text-primary"
          >
            <Download size={14} />
            {t("strategus.page.header.exportJson")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-0">
        {STEP_KEYS.map((stepKey, index) => {
          const isActive = index === step;
          const isDone = index < step;
          return (
            <div key={stepKey} className="flex items-center">
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                disabled={index > step}
                className={[
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/15 font-medium text-text-primary"
                    : isDone
                      ? "cursor-pointer text-success hover:bg-surface-overlay"
                      : "cursor-default text-text-ghost",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-success/20 text-success"
                        : "bg-surface-elevated text-text-ghost",
                  ].join(" ")}
                >
                  {isDone ? <Check size={10} /> : index + 1}
                </span>
                {t(`strategus.page.steps.${stepKey}`)}
              </button>
              {index < STEP_KEYS.length - 1 && (
                <ChevronRight
                  size={14}
                  className={isDone ? "text-success/50" : "text-text-disabled"}
                />
              )}
            </div>
          );
        })}
      </div>

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
            key={jsonEditorKey}
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

      <div className="flex items-center justify-between border-t border-border-default pt-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 0}
          className="flex items-center gap-2 rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:border-text-ghost hover:text-text-primary disabled:opacity-30"
        >
          <ChevronLeft size={15} />
          {t("strategus.common.back")}
        </button>

        {step < STEP_KEYS.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance()}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-40"
          >
            {t("strategus.common.next")}
            <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
