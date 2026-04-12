import { useState, useEffect, useCallback } from "react";
import {
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Globe,
  Shield,
  Database,
  Users,
  TrendingUp,
  BarChart3,
  Route,
  Scale,
  Brain,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Panel } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  useTestAtlasConnection,
  useDiscoverAtlasEntities,
  useStartAtlasMigration,
  useMigrationStatus,
  useRetryMigration,
} from "../hooks/useAtlasMigration";
import type {
  AtlasTestResult,
  AtlasDiscoveryResult,
  SelectedEntities,
  AtlasMigration,
} from "../api/migrationApi";

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { key: "connect", label: "Connect" },
  { key: "discover", label: "Discover" },
  { key: "select", label: "Select" },
  { key: "import", label: "Import" },
  { key: "summary", label: "Summary" },
] as const;

const ENTITY_TYPES = [
  { key: "concept_sets" as const, label: "Concept Sets", icon: Database, color: "text-blue-400" },
  { key: "cohort_definitions" as const, label: "Cohort Definitions", icon: Users, color: "text-purple-400" },
  { key: "incidence_rates" as const, label: "Incidence Rates", icon: TrendingUp, color: "text-emerald-400" },
  { key: "characterizations" as const, label: "Characterizations", icon: BarChart3, color: "text-amber-400" },
  { key: "pathways" as const, label: "Pathways", icon: Route, color: "text-teal-400" },
  { key: "estimations" as const, label: "Estimations", icon: Scale, color: "text-orange-400" },
  { key: "predictions" as const, label: "Predictions", icon: Brain, color: "text-pink-400" },
];

type EntityKey = (typeof ENTITY_TYPES)[number]["key"];

const EMPTY_SELECTION: SelectedEntities = {
  concept_sets: [],
  cohort_definitions: [],
  incidence_rates: [],
  characterizations: [],
  pathways: [],
  estimations: [],
  predictions: [],
};

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const sec = Math.round((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

// ── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between pl-8 pr-14 pt-6 pb-2">
      {STEPS.map((s, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isPending = index > currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all shrink-0",
                  isCompleted && "bg-accent text-surface-base",
                  isActive && "border-2 border-accent bg-accent/10 text-accent",
                  isPending && "border-2 border-surface-highlight text-text-ghost bg-transparent",
                )}
              >
                {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCompleted && "text-accent",
                  isActive && "text-text-primary",
                  isPending && "text-text-ghost",
                )}
              >
                {s.label}
              </span>
            </div>

            {!isLast && (
              <div className="flex-1 mx-2 mb-5">
                <div
                  className={cn(
                    "h-[2px] w-full rounded-full",
                    isCompleted ? "bg-accent" : "bg-surface-highlight",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Connect ──────────────────────────────────────────────────────────

function ConnectStep({
  config,
  setConfig,
  testResult,
  onTest,
  testing,
}: {
  config: { webapi_url: string; auth_type: string; auth_credentials: string };
  setConfig: (c: typeof config) => void;
  testResult: AtlasTestResult | null;
  onTest: () => void;
  testing: boolean;
}) {
  const inputCls =
    "w-full px-3 py-2.5 text-sm bg-surface-base border border-border-default rounded-lg text-text-primary placeholder-text-ghost focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30";
  const labelCls = "block text-xs font-medium text-text-muted mb-1.5";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Connect to Atlas WebAPI</h2>
        <p className="mt-1 text-sm text-text-muted">
          Enter the base URL of your existing OHDSI WebAPI instance. Parthenon will connect and
          inventory all available entities for migration.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>WebAPI Base URL</label>
          <div className="relative">
            <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
            <input
              className={`${inputCls} pl-9`}
              type="url"
              required
              value={config.webapi_url}
              onChange={(e) => setConfig({ ...config, webapi_url: e.target.value })}
              placeholder="https://atlas.example.com/WebAPI"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Authentication</label>
          <select
            className={inputCls}
            value={config.auth_type}
            onChange={(e) => setConfig({ ...config, auth_type: e.target.value })}
          >
            <option value="none">None (public WebAPI)</option>
            <option value="basic">Basic Authentication</option>
            <option value="bearer">Bearer Token</option>
          </select>
        </div>

        {config.auth_type === "basic" && (
          <div>
            <label className={labelCls}>Credentials (username:password)</label>
            <div className="relative">
              <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
              <input
                className={`${inputCls} pl-9`}
                type="password"
                value={config.auth_credentials}
                onChange={(e) => setConfig({ ...config, auth_credentials: e.target.value })}
                placeholder="username:password"
              />
            </div>
          </div>
        )}

        {config.auth_type === "bearer" && (
          <div>
            <label className={labelCls}>Bearer Token</label>
            <div className="relative">
              <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
              <input
                className={`${inputCls} pl-9`}
                type="password"
                value={config.auth_credentials}
                onChange={(e) => setConfig({ ...config, auth_credentials: e.target.value })}
                placeholder="your-api-token"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onTest}
          disabled={testing || !config.webapi_url}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface-base hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
          Test Connection
        </button>

        {testResult && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              testResult.success
                ? "border-success/20 bg-success/5 text-success"
                : "border-critical/20 bg-critical/5 text-critical",
            )}
          >
            {testResult.success ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <XCircle size={18} className="mt-0.5 shrink-0" />}
            <div>
              <p className="font-medium">{testResult.message}</p>
              {testResult.version && (
                <p className="mt-1 text-xs opacity-70">WebAPI version: {testResult.version}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Discover ─────────────────────────────────────────────────────────

function DiscoverStep({
  discovery,
  discovering,
  error,
}: {
  discovery: AtlasDiscoveryResult | null;
  discovering: boolean;
  error: string | null;
}) {
  if (discovering) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={32} className="animate-spin text-accent" />
        <div className="text-center">
          <p className="text-base font-semibold text-text-primary">Discovering entities...</p>
          <p className="mt-1 text-sm text-text-ghost">Querying all WebAPI endpoints in parallel</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-critical/20 bg-critical/5 px-4 py-3 text-sm text-critical">
        <XCircle size={18} /> {error}
      </div>
    );
  }

  if (!discovery) return null;

  const totalCount = ENTITY_TYPES.reduce(
    (sum, et) => sum + (discovery[et.key]?.count ?? 0), 0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Atlas Inventory</h2>
        <p className="mt-1 text-sm text-text-muted">
          Found <span className="font-semibold text-accent">{totalCount}</span> migratable entities
          across {ENTITY_TYPES.filter((et) => (discovery[et.key]?.count ?? 0) > 0).length} categories.
          {discovery.sources?.count > 0 && (
            <> Also found {discovery.sources.count} data source(s).</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {ENTITY_TYPES.map((et) => {
          const count = discovery[et.key]?.count ?? 0;
          const Icon = et.icon;
          return (
            <Panel key={et.key} className={cn("text-center py-5", count === 0 && "opacity-40")}>
              <Icon size={24} className={cn("mx-auto mb-2", et.color)} />
              <p className="text-2xl font-bold text-text-primary">{count}</p>
              <p className="text-xs text-text-muted mt-1">{et.label}</p>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Select ───────────────────────────────────────────────────────────

function SelectStep({
  discovery,
  selected,
  setSelected,
}: {
  discovery: AtlasDiscoveryResult;
  selected: SelectedEntities;
  setSelected: (s: SelectedEntities) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalSelected = Object.values(selected).reduce((sum, ids) => sum + ids.length, 0);

  function toggleAll(key: EntityKey, items: { id: number }[]) {
    const allIds = items.map((i) => i.id);
    const allSelected = allIds.every((id) => selected[key].includes(id));
    setSelected({ ...selected, [key]: allSelected ? [] : allIds });
  }

  function toggleOne(key: EntityKey, id: number) {
    const current = selected[key];
    setSelected({
      ...selected,
      [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    });
  }

  function selectAll() {
    const newSelected = { ...EMPTY_SELECTION };
    for (const et of ENTITY_TYPES) {
      newSelected[et.key] = (discovery[et.key]?.items ?? []).map((i) => i.id);
    }
    setSelected(newSelected);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Select Entities to Migrate</h2>
          <p className="mt-1 text-sm text-text-muted">
            Choose which entities to import. Dependencies are resolved automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={selectAll} className="px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-md transition-colors">
            Select All
          </button>
          <button type="button" onClick={() => setSelected({ ...EMPTY_SELECTION })} className="px-3 py-1.5 text-xs font-medium text-text-ghost hover:text-text-muted rounded-md transition-colors">
            Deselect All
          </button>
        </div>
      </div>

      {(selected.estimations.length > 0 || selected.predictions.length > 0 || selected.characterizations.length > 0 || selected.incidence_rates.length > 0 || selected.pathways.length > 0) && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p>
            Analysis entities may reference cohort definitions and concept sets by ID.
            Parthenon will remap these references automatically during import.
            For best results, include the referenced cohorts and concept sets in your selection.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {ENTITY_TYPES.map((et) => {
          const items = discovery[et.key]?.items ?? [];
          if (items.length === 0) return null;

          const Icon = et.icon;
          const isExpanded = expanded === et.key;
          const selectedCount = selected[et.key].length;
          const allSelected = items.length > 0 && selectedCount === items.length;

          return (
            <Panel key={et.key} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : et.key)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={et.color} />
                  <span className="text-sm font-semibold text-text-primary">{et.label}</span>
                  <span className="text-xs text-text-ghost">{selectedCount}/{items.length} selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleAll(et.key, items); }}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                      allSelected ? "bg-accent/15 text-accent" : "bg-surface-elevated text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </button>
                  {isExpanded ? <ChevronDown size={14} className="text-text-ghost" /> : <ChevronRight size={14} className="text-text-ghost" />}
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border-subtle space-y-1 max-h-60 overflow-y-auto">
                  {items.map((item) => (
                    <label key={item.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-surface-overlay cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selected[et.key].includes(item.id)}
                        onChange={() => toggleOne(et.key, item.id)}
                        className="accent-accent w-3.5 h-3.5"
                      />
                      <span className="text-sm text-text-secondary truncate flex-1">{item.name}</span>
                      <span className="text-[10px] text-text-ghost font-mono shrink-0">#{item.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="text-sm text-text-muted">
        <span className="font-semibold text-accent">{totalSelected}</span> entities selected for migration
      </div>
    </div>
  );
}

// ── Step 4: Import ───────────────────────────────────────────────────────────

function ImportStep({ migration }: { migration: AtlasMigration | null }) {
  if (!migration) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={32} className="animate-spin text-accent" />
        <p className="text-base font-semibold text-text-primary">Starting migration...</p>
      </div>
    );
  }

  const isRunning = migration.status === "importing" || migration.status === "pending";
  const progress = migration.total_entities > 0
    ? Math.round(((migration.imported_entities + migration.skipped_entities + migration.failed_entities) / migration.total_entities) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">
          {isRunning ? "Importing Entities..." : migration.status === "completed" ? "Migration Complete" : "Migration Failed"}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {isRunning && migration.current_step ? migration.current_step
            : migration.status === "completed" ? "All selected entities have been processed."
              : migration.error_message ?? "An error occurred during migration."}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
          <span>{progress}% complete</span>
          <span>{migration.imported_entities + migration.skipped_entities + migration.failed_entities} / {migration.total_entities}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-surface-elevated overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", migration.status === "failed" ? "bg-critical" : "bg-accent")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Panel className="text-center py-3">
          <p className="text-lg font-bold text-success">{migration.imported_entities}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Imported</p>
        </Panel>
        <Panel className="text-center py-3">
          <p className="text-lg font-bold text-accent">{migration.skipped_entities}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Skipped</p>
        </Panel>
        <Panel className="text-center py-3">
          <p className="text-lg font-bold text-critical">{migration.failed_entities}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Failed</p>
        </Panel>
      </div>

      {migration.mapping_summary && Object.keys(migration.mapping_summary).length > 0 && (
        <div className="rounded-lg border border-border-default overflow-hidden">
          <div className="px-3 py-2 bg-surface-overlay/50 text-[10px] font-medium text-text-ghost uppercase tracking-wider grid grid-cols-5 gap-2">
            <span className="col-span-2">Entity Type</span>
            <span className="text-center">Imported</span>
            <span className="text-center">Skipped</span>
            <span className="text-center">Failed</span>
          </div>
          {Object.entries(migration.mapping_summary).map(([type, stats]) => (
            <div key={type} className="px-3 py-2 border-t border-border-subtle grid grid-cols-5 gap-2 text-xs">
              <span className="col-span-2 text-text-secondary capitalize">{type.replace(/_/g, " ")}</span>
              <span className="text-center text-success">{stats.imported}</span>
              <span className="text-center text-accent">{stats.skipped}</span>
              <span className={cn("text-center", stats.failed > 0 ? "text-critical" : "text-text-ghost")}>{stats.failed}</span>
            </div>
          ))}
        </div>
      )}

      {migration.error_message && (
        <div className="flex items-start gap-2 rounded-lg border border-critical/20 bg-critical/5 px-4 py-3 text-sm text-critical">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <p>{migration.error_message}</p>
        </div>
      )}

      {isRunning && (
        <div className="flex items-center justify-center gap-2 text-xs text-text-ghost">
          <Loader2 size={12} className="animate-spin" /> Polling for updates...
        </div>
      )}
    </div>
  );
}

// ── Step 5: Summary ──────────────────────────────────────────────────────────

function SummaryStep({
  migration,
  onRetry,
  retrying,
  onClose,
}: {
  migration: AtlasMigration;
  onRetry: () => void;
  retrying: boolean;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        {migration.status === "completed" && migration.failed_entities === 0 ? (
          <>
            <CheckCircle2 size={48} className="mx-auto text-success mb-3" />
            <h2 className="text-xl font-bold text-text-primary">Migration Successful</h2>
          </>
        ) : migration.status === "completed" ? (
          <>
            <AlertCircle size={48} className="mx-auto text-accent mb-3" />
            <h2 className="text-xl font-bold text-text-primary">Migration Completed with Warnings</h2>
          </>
        ) : (
          <>
            <XCircle size={48} className="mx-auto text-critical mb-3" />
            <h2 className="text-xl font-bold text-text-primary">Migration Failed</h2>
          </>
        )}
        <p className="mt-2 text-sm text-text-muted">
          From <span className="font-mono text-text-secondary">{migration.webapi_url}</span>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Panel className="text-center py-4">
          <p className="text-2xl font-bold text-text-primary">{migration.total_entities}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Total</p>
        </Panel>
        <Panel className="text-center py-4">
          <p className="text-2xl font-bold text-success">{migration.imported_entities}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Imported</p>
        </Panel>
        <Panel className="text-center py-4">
          <p className="text-2xl font-bold text-accent">{migration.skipped_entities}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Skipped</p>
        </Panel>
        <Panel className="text-center py-4">
          <p className="text-2xl font-bold text-critical">{migration.failed_entities}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Failed</p>
        </Panel>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-text-ghost">
        <Clock size={12} />
        Duration: {formatDuration(migration.started_at, migration.completed_at)}
      </div>

      {migration.import_results && (
        <div className="rounded-lg border border-border-default overflow-hidden">
          <div className="px-3 py-2 bg-surface-overlay/50 text-[10px] font-medium text-text-ghost uppercase tracking-wider grid grid-cols-5 gap-2">
            <span className="col-span-2">Category</span>
            <span className="text-center">Imported</span>
            <span className="text-center">Skipped</span>
            <span className="text-center">Failed</span>
          </div>
          {Object.entries(migration.import_results).map(([type, stats]) => (
            <div key={type} className="px-3 py-2 border-t border-border-subtle grid grid-cols-5 gap-2 text-xs">
              <span className="col-span-2 text-text-secondary capitalize">{type.replace(/_/g, " ")}</span>
              <span className="text-center text-success">{stats.imported}</span>
              <span className="text-center text-accent">{stats.skipped}</span>
              <span className={cn("text-center", stats.failed > 0 ? "text-critical" : "text-text-ghost")}>{stats.failed}</span>
            </div>
          ))}
        </div>
      )}

      {migration.error_message && (
        <div className="flex items-start gap-2 rounded-lg border border-critical/20 bg-critical/5 px-4 py-3 text-sm text-critical">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <p>{migration.error_message}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-2">
        {migration.failed_entities > 0 && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 rounded-lg border border-accent/30 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
          >
            {retrying ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Retry Failed ({migration.failed_entities})
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface-base hover:bg-accent transition-colors"
        >
          <Check size={14} />
          Done
        </button>
      </div>
    </div>
  );
}

// ── Main Wizard Component (in-window modal) ──────────────────────────────────

interface Props {
  onClose: () => void;
}

export function AtlasMigrationWizard({ onClose }: Props) {
  // Wizard step state
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);

  // Step 1
  const [config, setConfig] = useState({ webapi_url: "", auth_type: "none", auth_credentials: "" });
  const [testResult, setTestResult] = useState<AtlasTestResult | null>(null);

  // Step 2
  const [discovery, setDiscovery] = useState<AtlasDiscoveryResult | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Step 3
  const [selected, setSelected] = useState<SelectedEntities>({ ...EMPTY_SELECTION });

  // Step 4/5
  const [migrationId, setMigrationId] = useState<number | null>(null);

  // Mutations
  const testMut = useTestAtlasConnection();
  const discoverMut = useDiscoverAtlasEntities();
  const startMut = useStartAtlasMigration();
  const retryMut = useRetryMigration();

  // Poll migration status during import
  const isImporting = currentStep === 3 && migrationId !== null;
  const { data: migrationStatus } = useMigrationStatus(migrationId, isImporting ? 2000 : undefined);

  const goTo = useCallback((index: number) => {
    setSlideDir(index > currentStep ? "forward" : "back");
    setAnimKey((k) => k + 1);
    setCurrentStep(index);
  }, [currentStep]);

  // Auto-advance from import to summary when complete
  useEffect(() => {
    if (
      migrationStatus &&
      (migrationStatus.status === "completed" || migrationStatus.status === "failed") &&
      currentStep === 3
    ) {
      const timeoutId = window.setTimeout(() => goTo(4), 800);
      return () => window.clearTimeout(timeoutId);
    }
  }, [migrationStatus, currentStep, goTo]);

  async function handleTest() {
    setTestResult(null);
    try {
      const result = await testMut.mutateAsync({
        webapi_url: config.webapi_url,
        auth_type: config.auth_type,
        auth_credentials: config.auth_credentials || undefined,
      });
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Connection failed", version: null, sources_count: 0 });
    }
  }

  async function handleDiscover() {
    setDiscovery(null);
    setDiscoveryError(null);
    goTo(1);
    try {
      const result = await discoverMut.mutateAsync({
        webapi_url: config.webapi_url,
        auth_type: config.auth_type,
        auth_credentials: config.auth_credentials || undefined,
      });
      setDiscovery(result);
    } catch (err: unknown) {
      setDiscoveryError(err instanceof Error ? err.message : "Discovery failed");
    }
  }

  async function handleStartMigration() {
    goTo(3);
    try {
      const result = await startMut.mutateAsync({
        webapi_url: config.webapi_url,
        webapi_name: config.webapi_url,
        auth_type: config.auth_type,
        auth_credentials: config.auth_credentials || undefined,
        selected_entities: selected,
      });
      setMigrationId(result.id);
    } catch {
      setMigrationId(null);
    }
  }

  async function handleRetry() {
    if (migrationId) await retryMut.mutateAsync(migrationId);
  }

  const canNext = (() => {
    switch (currentStep) {
      case 0: return testResult?.success === true;
      case 1: return discovery !== null && !discoverMut.isPending;
      case 2: return Object.values(selected).some((ids) => ids.length > 0);
      default: return false;
    }
  })();

  function handleNext() {
    switch (currentStep) {
      case 0: handleDiscover(); break;
      case 1: goTo(2); break;
      case 2: handleStartMigration(); break;
    }
  }

  function handlePrev() {
    if (currentStep > 0 && currentStep < 3) goTo(currentStep - 1);
  }

  const stepKey = STEPS[currentStep].key;
  const isFirstStep = currentStep === 0;
  const canDismiss = currentStep < 3; // Can't close during import

  return (
    <>
      {/* Slide keyframes — same as SetupWizard */}
      <style>{`
        @keyframes wizardSlideFromRight {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes wizardSlideFromLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/90 backdrop-blur-sm">
        <div className="relative mx-4 flex w-full max-w-4xl flex-col rounded-2xl border border-border-default bg-surface-raised shadow-2xl max-h-[90vh]">

          {/* Dismiss button — matches SetupWizard placement */}
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              title="Close — return any time via Administration"
              className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-text-ghost hover:text-text-muted transition-colors"
            >
              <X size={18} />
            </button>
          )}

          {/* Step indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* Animated step content */}
          <div className="flex-1 overflow-y-auto px-8 py-4">
            <div
              key={animKey}
              style={{
                animation: `${slideDir === "forward" ? "wizardSlideFromRight" : "wizardSlideFromLeft"} 220ms ease forwards`,
              }}
            >
              {stepKey === "connect" && (
                <ConnectStep config={config} setConfig={setConfig} testResult={testResult} onTest={handleTest} testing={testMut.isPending} />
              )}
              {stepKey === "discover" && (
                <DiscoverStep discovery={discovery} discovering={discoverMut.isPending} error={discoveryError} />
              )}
              {stepKey === "select" && discovery && (
                <SelectStep discovery={discovery} selected={selected} setSelected={setSelected} />
              )}
              {stepKey === "import" && (
                <ImportStep migration={migrationStatus ?? (startMut.data ?? null)} />
              )}
              {stepKey === "summary" && migrationStatus && (
                <SummaryStep migration={migrationStatus} onRetry={handleRetry} retrying={retryMut.isPending} onClose={onClose} />
              )}
            </div>
          </div>

          {/* Navigation footer — hidden on import + summary (matches SetupWizard: hidden on last step) */}
          {currentStep < 3 && (
            <div className="flex items-center justify-between border-t border-border-default px-8 py-4">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirstStep}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  isFirstStep ? "cursor-not-allowed text-surface-highlight" : "text-text-muted hover:text-text-secondary",
                )}
              >
                <ArrowLeft size={14} />
                Previous
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={!canNext}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-surface-base",
                  "hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                {currentStep === 2 ? (
                  <>
                    {startMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                    Start Migration
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
