import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Upload, RefreshCw, CheckCircle2, XCircle,
  Clock, Loader2, Trash2, Database, FileArchive, ChevronDown, ChevronUp,
} from "lucide-react";
import { Panel } from "@/components/ui";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import {
  fetchVocabImports, fetchVocabImport, uploadVocabZip, deleteVocabImport,
  type VocabularyImport, type VocabImportStatus,
} from "../api/adminApi";

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<VocabImportStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: "Queued",    color: "text-amber-500",   icon: Clock },
  running:   { label: "Running",   color: "text-blue-500",    icon: Loader2 },
  completed: { label: "Completed", color: "text-emerald-500", icon: CheckCircle2 },
  failed:    { label: "Failed",    color: "text-red-500",     icon: XCircle },
};

function StatusBadge({ status }: { status: VocabImportStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
      <Icon className={`h-4 w-4 ${status === "running" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatNum(n: number): string {
  return new Intl.NumberFormat().format(n);
}

// ── Log viewer ────────────────────────────────────────────────────────────────

function LogViewer({ importId }: { importId: number }) {
  const [expanded, setExpanded] = useState(true);
  const logRef = useRef<HTMLPreElement>(null);

  const { data } = useQuery({
    queryKey: ["vocab-import", importId],
    queryFn: () => fetchVocabImport(importId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 3000 : false;
    },
  });

  // Auto-scroll to bottom when log updates
  useEffect(() => {
    if (logRef.current && expanded) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [data?.log_output, expanded]);

  if (!data) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-background/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <span>Import Log</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <pre
          ref={logRef}
          className="max-h-64 overflow-y-auto px-4 pb-3 font-mono text-xs text-foreground/80 whitespace-pre-wrap"
        >
          {data.log_output ?? "(no output yet)"}
        </pre>
      )}
    </div>
  );
}

// ── Import card ───────────────────────────────────────────────────────────────

function ImportCard({ imp, onDelete }: { imp: VocabularyImport; onDelete: (id: number) => void }) {
  const queryClient = useQueryClient();

  const { data: live = imp } = useQuery({
    queryKey: ["vocab-import", imp.id],
    queryFn: () => fetchVocabImport(imp.id),
    initialData: imp,
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? imp.status;
      if (status === "running" || status === "pending") {
        queryClient.invalidateQueries({ queryKey: ["vocab-imports"] });
        return 3000;
      }
      return false;
    },
  });

  const isActive = live.status === "pending" || live.status === "running";
  const elapsed = live.started_at && live.completed_at
    ? Math.round((new Date(live.completed_at).getTime() - new Date(live.started_at).getTime()) / 1000)
    : null;

  return (
    <Panel className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileArchive className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate max-w-xs" title={live.file_name}>
            {live.file_name}
          </span>
          {live.file_size && (
            <span className="text-xs text-muted-foreground">({formatBytes(live.file_size)})</span>
          )}
        </div>
        <StatusBadge status={live.status} />
      </div>

      {/* Target schema / source */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {live.target_schema && (
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Schema: <code className="ml-0.5 text-foreground">{live.target_schema}</code>
          </span>
        )}
        {live.source && (
          <span className="flex items-center gap-1.5">
            Source: <span className="text-foreground">{live.source.source_name}</span>
          </span>
        )}
        {live.rows_loaded != null && (
          <span>Rows loaded: <span className="text-foreground font-medium">{formatNum(live.rows_loaded)}</span></span>
        )}
        {elapsed != null && (
          <span>Duration: <span className="text-foreground">{elapsed}s</span></span>
        )}
        <span>By: <span className="text-foreground">{live.user?.name ?? "—"}</span></span>
        <span>{new Date(live.created_at).toLocaleString()}</span>
      </div>

      {/* Progress bar (only while active) */}
      {isActive && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{live.progress_percentage}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${live.progress_percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {live.error_message && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {live.error_message}
        </div>
      )}

      {/* Log viewer */}
      <LogViewer importId={live.id} />

      {/* Actions */}
      {!isActive && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onDelete(live.id)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      )}
    </Panel>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({
  onUpload,
  uploading,
}: {
  onUpload: (file: File, sourceId?: number) => void;
  uploading: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) setSelectedFile(f);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    onUpload(selectedFile, selectedSource ? Number(selectedSource) : undefined);
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Panel className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Upload Athena Vocabulary ZIP</h2>
      <p className="text-sm text-muted-foreground">
        Download a vocabulary bundle from{" "}
        <span className="font-medium text-foreground">athena.ohdsi.org</span>, then upload it here.
        The import runs as a background job and can take 15–60 minutes depending on vocabulary size.
        Files up to <strong>5 GB</strong> are supported.
      </p>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : selectedFile
            ? "border-emerald-500 bg-emerald-500/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="sr-only"
          onChange={handleFileChange}
        />
        {selectedFile ? (
          <>
            <FileArchive className="h-10 w-10 text-emerald-500" />
            <div className="text-center">
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">{formatBytes(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-foreground">Drop Athena ZIP here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
          </>
        )}
      </div>

      {/* Source selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="vocab-source">
          Target CDM Source <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <select
          id="vocab-source"
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Default vocabulary schema</option>
          {sources.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.source_name} ({s.source_key})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Selects which source's vocabulary schema the import will populate. If no source is chosen,
          the default <code>vocab</code> connection schema is used.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!selectedFile || uploading}
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Uploading…" : "Start Import"}
        </button>
      </div>
    </Panel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VocabularyPage() {
  const queryClient = useQueryClient();

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ["vocab-imports"],
    queryFn: fetchVocabImports,
    refetchInterval: 10000,
  });

  const hasActive = imports.some((i) => i.status === "pending" || i.status === "running");

  const uploadMutation = useMutation({
    mutationFn: ({ file, sourceId }: { file: File; sourceId?: number }) =>
      uploadVocabZip(file, sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab-imports"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVocabImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab-imports"] });
    },
  });

  const handleUpload = (file: File, sourceId?: number) => {
    uploadMutation.mutate({ file, sourceId });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this import record?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md bg-violet-500/10 p-2">
            <BookOpen className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vocabulary Management</h1>
            <p className="text-sm text-muted-foreground">
              Update OMOP vocabulary tables from an Athena download ZIP.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["vocab-imports"] })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Instructions panel */}
      <Panel className="border-violet-500/20 bg-violet-500/5">
        <h3 className="font-semibold text-foreground mb-2">How to get a vocabulary ZIP from Athena</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>Visit <strong className="text-foreground">athena.ohdsi.org</strong> and sign in.</li>
          <li>Select the vocabulary domains and versions you need (e.g. SNOMED, RxNorm, LOINC).</li>
          <li>Click <strong className="text-foreground">Download Vocabularies</strong> — Athena will email you a download link.</li>
          <li>Download the ZIP (typically 500 MB – 3 GB) and upload it below.</li>
        </ol>
      </Panel>

      {/* Upload form */}
      {!hasActive && (
        <UploadZone onUpload={handleUpload} uploading={uploadMutation.isPending} />
      )}

      {uploadMutation.isError && (
        <div className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Upload failed: {(uploadMutation.error as Error)?.message ?? "Unknown error"}
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div className="rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          ZIP uploaded successfully. Import job is queued — check below for progress.
        </div>
      )}

      {/* Active notice */}
      {hasActive && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
          <p className="text-sm text-blue-400">
            An import is currently running. New uploads are disabled until it completes.
          </p>
        </div>
      )}

      {/* Import history */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Import History</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : imports.length === 0 ? (
          <Panel className="py-10 text-center text-muted-foreground text-sm">
            No vocabulary imports yet. Upload an Athena ZIP above to get started.
          </Panel>
        ) : (
          imports.map((imp) => (
            <ImportCard key={imp.id} imp={imp} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
