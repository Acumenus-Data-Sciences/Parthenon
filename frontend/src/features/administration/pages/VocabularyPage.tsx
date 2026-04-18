import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Upload, RefreshCw, CheckCircle2, XCircle,
  Clock, Loader2, Trash2, Database, FileArchive, ChevronDown, ChevronUp,
} from "lucide-react";
import { Panel } from "@/components/ui";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { formatDateTime, formatNumber } from "@/i18n/format";
import {
  fetchVocabImports, fetchVocabImport, uploadVocabZip, deleteVocabImport,
  type VocabularyImport, type VocabImportStatus,
} from "../api/adminApi";

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<VocabImportStatus, { labelKey: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { labelKey: "pending",   color: "text-amber-500",   icon: Clock },
  running:   { labelKey: "running",   color: "text-blue-500",    icon: Loader2 },
  completed: { labelKey: "completed", color: "text-emerald-500", icon: CheckCircle2 },
  failed:    { labelKey: "failed",    color: "text-red-500",     icon: XCircle },
};

function StatusBadge({ status }: { status: VocabImportStatus }) {
  const { t } = useTranslation("app");
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
      <Icon className={`h-4 w-4 ${status === "running" ? "animate-spin" : ""}`} />
      {t(`administration.vocabulary.status.${cfg.labelKey}`)}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, { maximumFractionDigits: 1 })} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
  return `${formatNumber(bytes / (1024 * 1024 * 1024), { maximumFractionDigits: 2 })} GB`;
}

// ── Log viewer ────────────────────────────────────────────────────────────────

function LogViewer({ importId }: { importId: number }) {
  const { t } = useTranslation("app");
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
        <span>{t("administration.vocabulary.log.title")}</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <pre
          ref={logRef}
          className="max-h-64 overflow-y-auto px-4 pb-3 font-mono text-xs text-foreground/80 whitespace-pre-wrap"
        >
          {data.log_output ?? t("administration.vocabulary.log.noOutput")}
        </pre>
      )}
    </div>
  );
}

// ── Import card ───────────────────────────────────────────────────────────────

function ImportCard({ imp, onDelete }: { imp: VocabularyImport; onDelete: (id: number) => void }) {
  const { t } = useTranslation("app");
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
            {t("administration.vocabulary.labels.schema")} <code className="ml-0.5 text-foreground">{live.target_schema}</code>
          </span>
        )}
        {live.source && (
          <span className="flex items-center gap-1.5">
            {t("administration.vocabulary.labels.source")} <span className="text-foreground">{live.source.source_name}</span>
          </span>
        )}
        {live.rows_loaded != null && (
          <span>{t("administration.vocabulary.labels.rowsLoaded")} <span className="text-foreground font-medium">{formatNumber(live.rows_loaded)}</span></span>
        )}
        {elapsed != null && (
          <span>{t("administration.vocabulary.labels.duration")} <span className="text-foreground">{t("administration.vocabulary.values.seconds", { value: formatNumber(elapsed) })}</span></span>
        )}
        <span>{t("administration.vocabulary.labels.by")} <span className="text-foreground">{live.user?.name ?? "—"}</span></span>
        <span>{formatDateTime(live.created_at)}</span>
      </div>

      {/* Progress bar (only while active) */}
      {isActive && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("administration.vocabulary.labels.progress")}</span>
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
            {t("administration.vocabulary.actions.remove")}
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
  const { t } = useTranslation("app");
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
      <h2 className="text-base font-semibold text-foreground">{t("administration.vocabulary.upload.title")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("administration.vocabulary.upload.descriptionPrefix")}{" "}
        <span className="font-medium text-foreground">athena.ohdsi.org</span>{" "}
        {t("administration.vocabulary.upload.descriptionMiddle")}{" "}
        {" "}
        {t("administration.vocabulary.upload.descriptionSuffix")}{" "}
        <strong>{t("administration.vocabulary.upload.maxFileSize")}</strong>.
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
              {t("administration.vocabulary.actions.remove")}
            </button>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-foreground">{t("administration.vocabulary.upload.dropHere")}</p>
              <p className="text-sm text-muted-foreground">{t("administration.vocabulary.upload.browse")}</p>
            </div>
          </>
        )}
      </div>

      {/* Source selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="vocab-source">
          {t("administration.vocabulary.upload.targetSource")} <span className="text-muted-foreground font-normal">{t("administration.vocabulary.labels.optional")}</span>
        </label>
        <select
          id="vocab-source"
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">{t("administration.vocabulary.upload.defaultSchema")}</option>
          {sources.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.source_name} ({s.source_key})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {t("administration.vocabulary.upload.sourceHelpPrefix")}{" "}
          <code>vocab</code>{" "}
          {t("administration.vocabulary.upload.sourceHelpSuffix")}
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
          {uploading
            ? t("administration.vocabulary.actions.uploading")
            : t("administration.vocabulary.actions.startImport")}
        </button>
      </div>
    </Panel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VocabularyPage() {
  const { t } = useTranslation("app");
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
    if (window.confirm(t("administration.vocabulary.messages.deleteConfirm"))) {
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
            <h1 className="text-2xl font-bold text-foreground">{t("administration.vocabulary.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("administration.vocabulary.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["vocab-imports"] })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("administration.vocabulary.actions.refresh")}
        </button>
      </div>

      {/* Instructions panel */}
      <Panel className="border-violet-500/20 bg-violet-500/5">
        <h3 className="font-semibold text-foreground mb-2">{t("administration.vocabulary.instructions.title")}</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>{t("administration.vocabulary.instructions.signInPrefix")} <strong className="text-foreground">athena.ohdsi.org</strong> {t("administration.vocabulary.instructions.signInSuffix")}</li>
          <li>{t("administration.vocabulary.instructions.selectDomains")}</li>
          <li>{t("administration.vocabulary.instructions.clickPrefix")} <strong className="text-foreground">{t("administration.vocabulary.instructions.downloadVocabularies")}</strong> {t("administration.vocabulary.instructions.clickSuffix")}</li>
          <li>{t("administration.vocabulary.instructions.uploadZip")}</li>
        </ol>
      </Panel>

      {/* Upload form */}
      {!hasActive && (
        <UploadZone onUpload={handleUpload} uploading={uploadMutation.isPending} />
      )}

      {uploadMutation.isError && (
        <div className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {t("administration.vocabulary.messages.uploadFailed", {
            message: (uploadMutation.error as Error)?.message ?? t("administration.vocabulary.messages.unknownError"),
          })}
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div className="rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {t("administration.vocabulary.messages.uploadSuccess")}
        </div>
      )}

      {/* Active notice */}
      {hasActive && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
          <p className="text-sm text-blue-400">
            {t("administration.vocabulary.messages.importRunning")}
          </p>
        </div>
      )}

      {/* Import history */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t("administration.vocabulary.history.title")}</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("administration.vocabulary.history.loading")}
          </div>
        ) : imports.length === 0 ? (
          <Panel className="py-10 text-center text-muted-foreground text-sm">
            {t("administration.vocabulary.history.empty")}
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
