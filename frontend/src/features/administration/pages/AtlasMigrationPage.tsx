import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
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
  History,
} from "lucide-react";
import { Panel } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  useTestAtlasConnection,
  useDiscoverAtlasEntities,
  useStartAtlasMigration,
  useMigrationStatus,
  useMigrationHistory,
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

type StepKey = (typeof STEPS)[number]["key"];

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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const sec = Math.round((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

// ── Step Indicator (matching SetupWizard) ────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between px-8 pt-6 pb-2">
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
                  isCompleted && "bg-[#C9A227] text-[#0E0E11]",
                  isActive && "border-2 border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]",
                  isPending && "border-2 border-[#323238] text-[#5A5650] bg-transparent",
                )}
              >
                {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCompleted && "text-[#C9A227]",
                  isActive && "text-[#F0EDE8]",
                  isPending && "text-[#5A5650]",
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
                    isCompleted ? "bg-[#C9A227]" : "bg-[#323238]",
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
    "w-full px-3 py-2.5 text-sm bg-[#0E0E11] border border-[#232328] rounded-lg text-[#F0EDE8] placeholder-[#5A5650] focus:outline-none focus:border-[#C9A227]/50 focus:ring-1 focus:ring-[#C9A227]/30";
  const labelCls = "block text-xs font-medium text-[#8A857D] mb-1.5";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#F0EDE8]">Connect to Atlas WebAPI</h2>
        <p className="mt-1 text-sm text-[#8A857D]">
          Enter the base URL of your existing OHDSI WebAPI instance. Parthenon will connect and
          inventory all available entities for migration.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>WebAPI Base URL</label>
          <div className="relative">
            <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
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
              <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
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
              <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
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
          className="inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-5 py-2.5 text-sm font-semibold text-[#0E0E11] hover:bg-[#D4AE3A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
          Test Connection
        </button>

        {testResult && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              testResult.success
                ? "border-[#2DD4BF]/20 bg-[#2DD4BF]/5 text-[#2DD4BF]"
                : "border-[#E85A6B]/20 bg-[#E85A6B]/5 text-[#E85A6B]",
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
        <Loader2 size={32} className="animate-spin text-[#C9A227]" />
        <div className="text-center">
          <p className="text-base font-semibold text-[#F0EDE8]">Discovering entities...</p>
          <p className="mt-1 text-sm text-[#5A5650]">Querying all WebAPI endpoints in parallel</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3 text-sm text-[#E85A6B]">
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
        <h2 className="text-xl font-bold text-[#F0EDE8]">Atlas Inventory</h2>
        <p className="mt-1 text-sm text-[#8A857D]">
          Found <span className="font-semibold text-[#C9A227]">{totalCount}</span> migratable entities
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
              <p className="text-2xl font-bold text-[#F0EDE8]">{count}</p>
              <p className="text-xs text-[#8A857D] mt-1">{et.label}</p>
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
    setSelected({
      ...selected,
      [key]: allSelected ? [] : allIds,
    });
  }

  function toggleOne(key: EntityKey, id: number) {
    const current = selected[key];
    setSelected({
      ...selected,
      [key]: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    });
  }

  function selectAll() {
    const newSelected = { ...EMPTY_SELECTION };
    for (const et of ENTITY_TYPES) {
      const items = discovery[et.key]?.items ?? [];
      newSelected[et.key] = items.map((i) => i.id);
    }
    setSelected(newSelected);
  }

  function deselectAll() {
    setSelected({ ...EMPTY_SELECTION });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#F0EDE8]">Select Entities to Migrate</h2>
          <p className="mt-1 text-sm text-[#8A857D]">
            Choose which entities to import. Dependencies are resolved automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={selectAll} className="px-3 py-1.5 text-xs font-medium text-[#C9A227] hover:bg-[#C9A227]/10 rounded-md transition-colors">
            Select All
          </button>
          <button type="button" onClick={deselectAll} className="px-3 py-1.5 text-xs font-medium text-[#5A5650] hover:text-[#8A857D] rounded-md transition-colors">
            Deselect All
          </button>
        </div>
      </div>

      {/* Dependency notice */}
      {(selected.estimations.length > 0 || selected.predictions.length > 0 || selected.characterizations.length > 0 || selected.incidence_rates.length > 0 || selected.pathways.length > 0) && (
        <div className="flex items-start gap-2 rounded-lg border border-[#C9A227]/20 bg-[#C9A227]/5 px-4 py-3 text-xs text-[#C9A227]">
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
                  <span className="text-sm font-semibold text-[#F0EDE8]">{et.label}</span>
                  <span className="text-xs text-[#5A5650]">
                    {selectedCount}/{items.length} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleAll(et.key, items); }}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                      allSelected
                        ? "bg-[#C9A227]/15 text-[#C9A227]"
                        : "bg-[#232328] text-[#8A857D] hover:text-[#C5C0B8]",
                    )}
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </button>
                  {isExpanded ? <ChevronDown size={14} className="text-[#5A5650]" /> : <ChevronRight size={14} className="text-[#5A5650]" />}
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-[#1E1E23] space-y-1 max-h-60 overflow-y-auto">
                  {items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-[#1E1E23] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected[et.key].includes(item.id)}
                        onChange={() => toggleOne(et.key, item.id)}
                        className="accent-[#C9A227] w-3.5 h-3.5"
                      />
                      <span className="text-sm text-[#C5C0B8] truncate flex-1">{item.name}</span>
                      <span className="text-[10px] text-[#5A5650] font-mono shrink-0">#{item.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="text-sm text-[#8A857D]">
        <span className="font-semibold text-[#C9A227]">{totalSelected}</span> entities selected for migration
      </div>
    </div>
  );
}

// ── Step 4: Import ───────────────────────────────────────────────────────────

function ImportStep({
  migration,
}: {
  migration: AtlasMigration | null;
}) {
  if (!migration) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={32} className="animate-spin text-[#C9A227]" />
        <p className="text-base font-semibold text-[#F0EDE8]">Starting migration...</p>
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
        <h2 className="text-xl font-bold text-[#F0EDE8]">
          {isRunning ? "Importing Entities..." : migration.status === "completed" ? "Migration Complete" : "Migration Failed"}
        </h2>
        <p className="mt-1 text-sm text-[#8A857D]">
          {isRunning && migration.current_step
            ? migration.current_step
            : migration.status === "completed"
              ? "All selected entities have been processed."
              : migration.error_message ?? "An error occurred during migration."}
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-[#8A857D] mb-1.5">
          <span>{progress}% complete</span>
          <span>
            {migration.imported_entities + migration.skipped_entities + migration.failed_entities} / {migration.total_entities}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[#232328] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              migration.status === "failed" ? "bg-[#E85A6B]" : "bg-[#C9A227]",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Panel className="text-center py-3">
          <p className="text-lg font-bold text-[#2DD4BF]">{migration.imported_entities}</p>
          <p className="text-[10px] text-[#8A857D] uppercase tracking-wider">Imported</p>
        </Panel>
        <Panel className="text-center py-3">
          <p className="text-lg font-bold text-[#C9A227]">{migration.skipped_entities}</p>
          <p className="text-[10px] text-[#8A857D] uppercase tracking-wider">Skipped</p>
        </Panel>
        <Panel className="text-center py-3">
          <p className="text-lg font-bold text-[#E85A6B]">{migration.failed_entities}</p>
          <p className="text-[10px] text-[#8A857D] uppercase tracking-wider">Failed</p>
        </Panel>
      </div>

      {/* Per-entity breakdown */}
      {migration.mapping_summary && Object.keys(migration.mapping_summary).length > 0 && (
        <div className="rounded-lg border border-[#232328] overflow-hidden">
          <div className="px-3 py-2 bg-[#1E1E23]/50 text-[10px] font-medium text-[#5A5650] uppercase tracking-wider grid grid-cols-5 gap-2">
            <span className="col-span-2">Entity Type</span>
            <span className="text-center">Imported</span>
            <span className="text-center">Skipped</span>
            <span className="text-center">Failed</span>
          </div>
          {Object.entries(migration.mapping_summary).map(([type, stats]) => {
            const et = ENTITY_TYPES.find((e) => e.key === type + "s" || e.key.startsWith(type));
            return (
              <div key={type} className="px-3 py-2 border-t border-[#1E1E23] grid grid-cols-5 gap-2 text-xs">
                <span className="col-span-2 text-[#C5C0B8] capitalize">{type.replace(/_/g, " ")}</span>
                <span className="text-center text-[#2DD4BF]">{stats.imported}</span>
                <span className="text-center text-[#C9A227]">{stats.skipped}</span>
                <span className={cn("text-center", stats.failed > 0 ? "text-[#E85A6B]" : "text-[#5A5650]")}>{stats.failed}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {migration.error_message && (
        <div className="flex items-start gap-2 rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3 text-sm text-[#E85A6B]">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <p>{migration.error_message}</p>
        </div>
      )}

      {isRunning && (
        <div className="flex items-center justify-center gap-2 text-xs text-[#5A5650]">
          <Loader2 size={12} className="animate-spin" />
          Polling for updates...
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
}: {
  migration: AtlasMigration;
  onRetry: () => void;
  retrying: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        {migration.status === "completed" && migration.failed_entities === 0 ? (
          <>
            <CheckCircle2 size={48} className="mx-auto text-[#2DD4BF] mb-3" />
            <h2 className="text-xl font-bold text-[#F0EDE8]">Migration Successful</h2>
          </>
        ) : migration.status === "completed" ? (
          <>
            <AlertCircle size={48} className="mx-auto text-[#C9A227] mb-3" />
            <h2 className="text-xl font-bold text-[#F0EDE8]">Migration Completed with Warnings</h2>
          </>
        ) : (
          <>
            <XCircle size={48} className="mx-auto text-[#E85A6B] mb-3" />
            <h2 className="text-xl font-bold text-[#F0EDE8]">Migration Failed</h2>
          </>
        )}
        <p className="mt-2 text-sm text-[#8A857D]">
          From <span className="font-mono text-[#C5C0B8]">{migration.webapi_url}</span>
        </p>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-4 gap-3">
        <Panel className="text-center py-4">
          <p className="text-2xl font-bold text-[#F0EDE8]">{migration.total_entities}</p>
          <p className="text-[10px] text-[#8A857D] uppercase tracking-wider mt-1">Total</p>
        </Panel>
        <Panel className="text-center py-4">
          <p className="text-2xl font-bold text-[#2DD4BF]">{migration.imported_entities}</p>
          <p className="text-[10px] text-[#8A857D] uppercase tracking-wider mt-1">Imported</p>
        </Panel>
        <Panel className="text-center py-4">
          <p className="text-2xl font-bold text-[#C9A227]">{migration.skipped_entities}</p>
          <p className="text-[10px] text-[#8A857D] uppercase tracking-wider mt-1">Skipped</p>
        </Panel>
        <Panel className="text-center py-4">
          <p className="text-2xl font-bold text-[#E85A6B]">{migration.failed_entities}</p>
          <p className="text-[10px] text-[#8A857D] uppercase tracking-wider mt-1">Failed</p>
        </Panel>
      </div>

      {/* Duration */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#5A5650]">
        <Clock size={12} />
        Duration: {formatDuration(migration.started_at, migration.completed_at)}
      </div>

      {/* Per-type breakdown */}
      {migration.import_results && (
        <div className="rounded-lg border border-[#232328] overflow-hidden">
          <div className="px-3 py-2 bg-[#1E1E23]/50 text-[10px] font-medium text-[#5A5650] uppercase tracking-wider grid grid-cols-5 gap-2">
            <span className="col-span-2">Category</span>
            <span className="text-center">Imported</span>
            <span className="text-center">Skipped</span>
            <span className="text-center">Failed</span>
          </div>
          {Object.entries(migration.import_results).map(([type, stats]) => (
            <div key={type} className="px-3 py-2 border-t border-[#1E1E23] grid grid-cols-5 gap-2 text-xs">
              <span className="col-span-2 text-[#C5C0B8] capitalize">{type.replace(/_/g, " ")}</span>
              <span className="text-center text-[#2DD4BF]">{stats.imported}</span>
              <span className="text-center text-[#C9A227]">{stats.skipped}</span>
              <span className={cn("text-center", stats.failed > 0 ? "text-[#E85A6B]" : "text-[#5A5650]")}>{stats.failed}</span>
            </div>
          ))}
        </div>
      )}

      {migration.error_message && (
        <div className="flex items-start gap-2 rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3 text-sm text-[#E85A6B]">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <p>{migration.error_message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 pt-2">
        {migration.failed_entities > 0 && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 rounded-lg border border-[#C9A227]/30 px-4 py-2.5 text-sm font-medium text-[#C9A227] hover:bg-[#C9A227]/10 transition-colors disabled:opacity-40"
          >
            {retrying ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Retry Failed ({migration.failed_entities})
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-5 py-2.5 text-sm font-semibold text-[#0E0E11] hover:bg-[#D4AE3A] transition-colors"
        >
          <Check size={14} />
          Done
        </button>
      </div>
    </div>
  );
}

// ── Migration History Panel ──────────────────────────────────────────────────

function HistoryPanel() {
  const { data: history, isLoading } = useMigrationHistory();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-[#5A5650]">
        <Loader2 size={12} className="animate-spin" /> Loading history...
      </div>
    );
  }

  if (!history || history.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-[#8A857D] mb-3 flex items-center gap-2">
        <History size={14} /> Past Migrations
      </h3>
      <div className="rounded-lg border border-[#232328] overflow-hidden">
        {history.slice(0, 5).map((m) => (
          <div key={m.id} className="flex items-center gap-4 px-4 py-3 border-b border-[#1E1E23] last:border-0 text-xs">
            <span
              className={cn(
                "px-2 py-0.5 rounded-full font-medium min-w-[80px] text-center",
                m.status === "completed" && "bg-[#2DD4BF]/15 text-[#2DD4BF]",
                m.status === "failed" && "bg-[#E85A6B]/15 text-[#E85A6B]",
                m.status === "importing" && "bg-blue-400/15 text-blue-400",
                !["completed", "failed", "importing"].includes(m.status) && "bg-[#232328] text-[#8A857D]",
              )}
            >
              {m.status}
            </span>
            <span className="text-[#C5C0B8] truncate max-w-[200px] font-mono text-[11px]">{m.webapi_url}</span>
            <span className="text-[#5A5650]">{formatDate(m.created_at)}</span>
            <span className="text-[#2DD4BF]">{m.imported_entities} imported</span>
            {m.failed_entities > 0 && <span className="text-[#E85A6B]">{m.failed_entities} failed</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AtlasMigrationPage() {
  const navigate = useNavigate();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);

  // Step 1 state
  const [config, setConfig] = useState({ webapi_url: "", auth_type: "none", auth_credentials: "" });
  const [testResult, setTestResult] = useState<AtlasTestResult | null>(null);

  // Step 2 state
  const [discovery, setDiscovery] = useState<AtlasDiscoveryResult | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Step 3 state
  const [selected, setSelected] = useState<SelectedEntities>({ ...EMPTY_SELECTION });

  // Step 4/5 state
  const [migrationId, setMigrationId] = useState<number | null>(null);

  // Mutations
  const testMut = useTestAtlasConnection();
  const discoverMut = useDiscoverAtlasEntities();
  const startMut = useStartAtlasMigration();
  const retryMut = useRetryMigration();

  // Poll migration status during import
  const isImporting = currentStep === 3 && migrationId !== null;
  const { data: migrationStatus } = useMigrationStatus(
    migrationId,
    isImporting ? 2000 : undefined,
  );

  // Auto-advance from import to summary when complete
  useEffect(() => {
    if (migrationStatus && (migrationStatus.status === "completed" || migrationStatus.status === "failed")) {
      if (currentStep === 3) {
        // Small delay so user sees 100%
        setTimeout(() => goTo(4), 800);
      }
    }
  }, [migrationStatus?.status]);

  function goTo(index: number) {
    setSlideDir(index > currentStep ? "forward" : "back");
    setAnimKey((k) => k + 1);
    setCurrentStep(index);
  }

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
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection failed",
        version: null,
        sources_count: 0,
      });
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
    } catch (err: unknown) {
      // Migration creation itself failed
      setMigrationId(null);
    }
  }

  async function handleRetry() {
    if (!migrationId) return;
    await retryMut.mutateAsync(migrationId);
  }

  // Can proceed to next step?
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
    if (currentStep > 0 && currentStep < 3) {
      goTo(currentStep - 1);
    }
  }

  const stepKey = STEPS[currentStep].key;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Migrate from Atlas</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Import cohort definitions, concept sets, and analysis designs from an existing OHDSI Atlas installation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="inline-flex items-center gap-2 rounded-lg border border-[#232328] px-4 py-2 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#232328] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Admin
        </button>
      </div>

      {/* Wizard card */}
      <div className="rounded-2xl border border-[#232328] bg-[#151518] shadow-xl">
        {/* Step indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Step content */}
        <div className="px-8 py-6">
          <div
            key={animKey}
            style={{
              animation: `${slideDir === "forward" ? "wizardSlideFromRight" : "wizardSlideFromLeft"} 220ms ease forwards`,
            }}
          >
            {stepKey === "connect" && (
              <ConnectStep
                config={config}
                setConfig={setConfig}
                testResult={testResult}
                onTest={handleTest}
                testing={testMut.isPending}
              />
            )}
            {stepKey === "discover" && (
              <DiscoverStep
                discovery={discovery}
                discovering={discoverMut.isPending}
                error={discoveryError}
              />
            )}
            {stepKey === "select" && discovery && (
              <SelectStep
                discovery={discovery}
                selected={selected}
                setSelected={setSelected}
              />
            )}
            {stepKey === "import" && (
              <ImportStep migration={migrationStatus ?? (startMut.data ?? null)} />
            )}
            {stepKey === "summary" && migrationStatus && (
              <SummaryStep
                migration={migrationStatus}
                onRetry={handleRetry}
                retrying={retryMut.isPending}
              />
            )}
          </div>
        </div>

        {/* Navigation footer (hidden during import and summary) */}
        {currentStep < 3 && (
          <div className="flex items-center justify-between border-t border-[#232328] px-8 py-4">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                currentStep === 0
                  ? "cursor-not-allowed text-[#323238]"
                  : "text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              <ArrowLeft size={14} />
              Previous
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={!canNext}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-5 py-2 text-sm font-semibold text-[#0E0E11] hover:bg-[#D4AE3A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* History below the wizard */}
      <HistoryPanel />

      {/* Slide animation keyframes */}
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
    </div>
  );
}
