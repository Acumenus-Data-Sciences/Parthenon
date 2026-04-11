import { useState } from "react";
import { Globe, Database, Loader2, RefreshCw, Terminal, Copy, Check } from "lucide-react";
import { Panel, Badge, Button, JobProgressModal } from "@/components/ui";
import { useGisStats, useLoadDataset, useDatasetStatus } from "@/features/gis/hooks/useGis";
import type { AdminLevel } from "@/features/gis/types";
import { ImportWizard } from "./gis-import/ImportWizard";

const SOURCES = [
  {
    id: "gadm",
    name: "GADM v4.1",
    description: "Global Administrative Areas — 356K boundaries across 6 admin levels",
    size: "2.6 GB",
  },
  {
    id: "geoboundaries",
    name: "geoBoundaries CGAZ",
    description: "Simplified boundaries for cartographic consistency (ADM0-2)",
    size: "1.2 GB",
  },
] as const;

const LEVEL_OPTIONS: { value: AdminLevel; label: string }[] = [
  { value: "ADM0", label: "Countries (ADM0)" },
  { value: "ADM1", label: "States / Provinces (ADM1)" },
  { value: "ADM2", label: "Districts / Counties (ADM2)" },
  { value: "ADM3", label: "Sub-districts (ADM3)" },
];

export function GisDataPanel() {
  const { data: stats, isLoading: statsLoading, refetch } = useGisStats();
  const loadMutation = useLoadDataset();

  const [activeTab, setActiveTab] = useState<"boundaries" | "import">("boundaries");
  const [selectedSource, setSelectedSource] = useState<string>("gadm");
  const [selectedLevels, setSelectedLevels] = useState<AdminLevel[]>(["ADM0", "ADM1"]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [cliCommand, setCliCommand] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: jobData } = useDatasetStatus(activeJobId);

  const toggleLevel = (level: AdminLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const handleLoad = () => {
    loadMutation.mutate(
      { source: selectedSource, levels: selectedLevels },
      {
        onSuccess: (result) => {
          setActiveJobId(result.dataset.id);
          setCliCommand(result.cli_command);
          setModalOpen(true);
        },
      }
    );
  };

  const handleCopy = async () => {
    if (cliCommand) {
      await navigator.clipboard.writeText(cliCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setActiveJobId(null);
    setCliCommand(null);
    refetch();
  };

  const hasBoundaries = (stats?.total_boundaries ?? 0) > 0;

  // Derive modal props from polled job data (fall back to mutation response)
  const job = jobData ?? loadMutation.data?.dataset ?? null;
  const jobStatus = job?.status ?? "pending";
  const jobProgress = job?.progress_percentage ?? 0;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-accent" />
          <div>
            <p className="font-semibold text-foreground">GIS Boundary Data</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage geographic boundary datasets for the GIS Explorer
            </p>
          </div>
        </div>
        <Badge variant={hasBoundaries ? "success" : "warning"}>
          {hasBoundaries ? "loaded" : "empty"}
        </Badge>
      </div>

      {/* Tab navigation */}
      <div className="mt-4 flex border-b border-border-default">
        <button
          onClick={() => setActiveTab("boundaries")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "boundaries"
              ? "border-b-2 border-accent text-accent"
              : "text-text-ghost hover:text-text-muted"
          }`}
        >
          Boundaries
        </button>
        <button
          onClick={() => setActiveTab("import")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "import"
              ? "border-b-2 border-accent text-accent"
              : "text-text-ghost hover:text-text-muted"
          }`}
        >
          Data Import
        </button>
      </div>

      {activeTab === "import" && (
        <div className="mt-4">
          <ImportWizard />
        </div>
      )}

      {activeTab === "boundaries" && (
        <>
      {/* Current stats */}
      {statsLoading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking boundary data...
        </div>
      ) : stats && hasBoundaries ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Boundaries:{" "}
              <span className="font-medium text-foreground">
                {stats.total_boundaries.toLocaleString()}
              </span>
            </span>
            <span className="text-muted-foreground">
              Countries:{" "}
              <span className="font-medium text-foreground">
                {stats.total_countries}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.levels
              .filter((l) => l.count > 0)
              .map((l) => (
                <span
                  key={l.code}
                  className="rounded bg-surface-elevated px-2 py-0.5 text-xs text-text-muted"
                >
                  {l.label}: {l.count.toLocaleString()}
                </span>
              ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No boundary data loaded. Select a source and levels below to begin.
        </p>
      )}

      {/* Load controls */}
      <div className="mt-4 space-y-3 rounded-lg border border-border-default bg-surface-base p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
          Load Boundaries
        </h4>

        {/* Source selector */}
        <div className="space-y-2">
          {SOURCES.map((src) => (
            <label
              key={src.id}
              className={`flex cursor-pointer items-start gap-3 rounded border p-2 transition-colors ${
                selectedSource === src.id
                  ? "border-accent/50 bg-accent/5"
                  : "border-border-default hover:border-text-ghost"
              }`}
            >
              <input
                type="radio"
                name="gis-source"
                value={src.id}
                checked={selectedSource === src.id}
                onChange={() => setSelectedSource(src.id)}
                className="mt-0.5 accent-accent"
              />
              <div>
                <p className="text-sm font-medium text-[#E8E4DC]">{src.name}</p>
                <p className="text-xs text-text-ghost">
                  {src.description} ({src.size})
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* Level selector */}
        <div>
          <p className="mb-1.5 text-xs text-text-muted">Admin levels to load:</p>
          <div className="flex flex-wrap gap-2">
            {LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleLevel(opt.value)}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  selectedLevels.includes(opt.value)
                    ? "bg-accent/20 text-accent"
                    : "bg-surface-elevated text-text-ghost hover:text-text-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Load button */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleLoad}
            disabled={loadMutation.isPending || selectedLevels.length === 0}
          >
            {loadMutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Database className="mr-1 h-3 w-3" />
                Generate Load Command
              </>
            )}
          </Button>

          {hasBoundaries && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Refresh Stats
            </Button>
          )}
        </div>
      </div>

      {/* CLI command modal */}
      {modalOpen && cliCommand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-lg border border-border-default bg-[#18181B] p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-accent">
              <Terminal className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Run on Host</h3>
            </div>
            <p className="mt-2 text-sm text-text-muted">
              GIS data loads directly to local PostgreSQL 17. Run this command from
              the project root:
            </p>
            <div className="group mt-3 flex items-start gap-2 rounded-lg border border-border-default bg-surface-base p-3">
              <code className="flex-1 break-all text-sm text-success">
                {cliCommand}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded p-1 text-text-ghost hover:text-accent"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-3 text-xs text-text-ghost">
              The <code className="text-text-muted">--dataset-id</code> flag enables
              progress tracking. Refresh stats after the script completes.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={handleModalClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Job progress modal (shows when script is running with --dataset-id) */}
      {job && activeJobId && jobStatus !== "pending" && (
        <JobProgressModal
          open={modalOpen && !cliCommand}
          onClose={handleModalClose}
          title="Loading GIS Boundaries"
          description={`Source: ${job.source} | Levels: ${job.levels_requested?.join(", ") ?? "all"}`}
          status={jobStatus as "pending" | "running" | "completed" | "failed"}
          progress={jobProgress}
          logOutput={job.log_output}
          startedAt={job.started_at}
          completedAt={job.completed_at}
          errorMessage={job.error_message}
        />
      )}
        </>
      )}
    </Panel>
  );
}
