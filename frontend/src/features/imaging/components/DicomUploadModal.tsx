import { useState, useCallback, useRef } from "react";
import { X, Upload, FileUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useSourceStore } from "@/stores/sourceStore";

interface DicomUploadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface UploadProgress {
  total: number;
  uploaded: number;
  failed: number;
  currentFile: string;
}

interface OrthancUploadResult {
  ID: string;
  ParentStudy: string;
  ParentSeries: string;
  ParentPatient: string;
  Status: string;
}

interface StudySummary {
  orthancId: string;
  patientName: string;
  studyDescription: string;
  studyDate: string;
  seriesCount: number;
  thumbnailInstanceId: string | null;
}

type UploadState = "idle" | "uploading" | "indexing" | "done" | "error";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const CONCURRENT_UPLOADS = 4;

export function DicomUploadModal({ open, onClose, onComplete }: DicomUploadModalProps) {
  const activeSourceId = useSourceStore((s) => s.activeSourceId);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState<UploadProgress>({ total: 0, uploaded: 0, failed: 0, currentFile: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    setFiles([]);
    setState("idle");
    setProgress({ total: 0, uploaded: 0, failed: 0, currentFile: "" });
    setErrorMsg("");
    setStudies([]);
    abortRef.current = false;
  }, []);

  const handleClose = () => {
    if (state === "uploading" || state === "indexing") return;
    reset();
    onClose();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  }, []);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => {
      if (f.size > MAX_FILE_SIZE) return false;
      const name = f.name.toLowerCase();
      return name.endsWith(".dcm") || name.endsWith(".ima") || !name.includes(".") || name.match(/^\d+$/);
    });
    setFiles((prev) => [...prev, ...valid]);
  };

  const fetchStudySummaries = async (uploadResults: OrthancUploadResult[]) => {
    // Deduplicate by study ID
    const studyIds = [...new Set(uploadResults.map((r) => r.ParentStudy))];
    const summaries: StudySummary[] = [];

    for (const studyId of studyIds) {
      try {
        const resp = await fetch(`/orthanc/studies/${studyId}`);
        if (!resp.ok) continue;
        const data = await resp.json();
        const tags = data.MainDicomTags ?? {};
        const ptags = data.PatientMainDicomTags ?? {};
        const seriesIds: string[] = data.Series ?? [];

        // Get first instance for thumbnail
        let thumbnailInstanceId: string | null = null;
        if (seriesIds.length > 0) {
          try {
            const sResp = await fetch(`/orthanc/series/${seriesIds[0]}`);
            if (sResp.ok) {
              const sData = await sResp.json();
              const instances: string[] = sData.Instances ?? [];
              if (instances.length > 0) {
                thumbnailInstanceId = instances[0];
              }
            }
          } catch { /* skip thumbnail */ }
        }

        summaries.push({
          orthancId: studyId,
          patientName: (ptags.PatientName ?? "Unknown").replace(/\^/g, " "),
          studyDescription: tags.StudyDescription ?? "",
          studyDate: formatDicomDate(tags.StudyDate ?? ""),
          seriesCount: seriesIds.length,
          thumbnailInstanceId,
        });
      } catch { /* skip study */ }
    }

    setStudies(summaries);
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setState("uploading");
    abortRef.current = false;

    const total = files.length;
    let uploaded = 0;
    let failed = 0;
    const uploadResults: OrthancUploadResult[] = [];

    for (let i = 0; i < total; i += CONCURRENT_UPLOADS) {
      if (abortRef.current) break;
      const batch = files.slice(i, i + CONCURRENT_UPLOADS);

      const results = await Promise.allSettled(
        batch.map(async (file) => {
          setProgress({ total, uploaded, failed, currentFile: file.name });
          const resp = await fetch("/orthanc/instances", {
            method: "POST",
            headers: { "Content-Type": "application/dicom" },
            body: file,
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp.json() as Promise<OrthancUploadResult>;
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value?.ParentStudy) {
          uploaded++;
          uploadResults.push(r.value);
        } else {
          failed++;
        }
      }
      setProgress({ total, uploaded, failed, currentFile: "" });
    }

    setProgress({ total, uploaded, failed, currentFile: "" });

    if (uploaded === 0) {
      setState("error");
      setErrorMsg("No files were accepted by Orthanc. Ensure the files are valid DICOM.");
      return;
    }

    // Index newly uploaded studies into Parthenon
    setState("indexing");
    if (activeSourceId) {
      try {
        await apiClient.post("/imaging/studies/index-from-dicomweb", {
          source_id: activeSourceId,
          sync_all: true,
          batch_size: 100,
          limit: 200,
        });
      } catch {
        // Indexing failure is non-fatal — studies are in Orthanc either way
      }
    }

    // Fetch study summaries for the done screen
    await fetchStudySummaries(uploadResults);

    setState("done");
    onComplete();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-border-default bg-surface-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-info" />
            <h2 className="text-sm font-semibold text-text-primary">Import DICOM Files</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={state === "uploading" || state === "indexing"}
            className="rounded p-1 text-text-ghost hover:text-text-primary disabled:opacity-30 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {state === "idle" && (
            <>
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-default bg-surface-base px-6 py-10 cursor-pointer hover:border-info/50 transition-colors"
              >
                <FileUp size={32} className="text-text-ghost" />
                <div className="text-center">
                  <p className="text-sm text-text-secondary">
                    Drag & drop DICOM files or <span className="text-info underline">browse</span>
                  </p>
                  <p className="mt-1 text-[10px] text-text-ghost">
                    .dcm files up to 2 GB each. Folders not supported — select files directly.
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".dcm,.ima,application/dicom"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-muted">{files.length} file{files.length !== 1 ? "s" : ""} selected</p>
                    <button
                      onClick={() => setFiles([])}
                      className="text-[10px] text-critical hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto rounded border border-border-default bg-surface-base divide-y divide-surface-overlay">
                    {files.slice(0, 50).map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="text-text-secondary truncate max-w-[360px] font-mono">{f.name}</span>
                        <span className="text-text-ghost flex-shrink-0 ml-2">
                          {(f.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    ))}
                    {files.length > 50 && (
                      <div className="px-3 py-1.5 text-[10px] text-text-ghost">
                        … and {files.length - 50} more files
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {(state === "uploading" || state === "indexing") && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-info" />
                <span className="text-sm text-text-secondary">
                  {state === "uploading"
                    ? `Uploading to Orthanc… ${progress.uploaded + progress.failed}/${progress.total}`
                    : "Indexing studies…"}
                </span>
              </div>
              {state === "uploading" && progress.total > 0 && (
                <>
                  <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                    <div
                      className="h-full bg-info transition-all duration-300"
                      style={{ width: `${((progress.uploaded + progress.failed) / progress.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-success">{progress.uploaded} uploaded</span>
                    {progress.failed > 0 && <span className="text-critical">{progress.failed} failed</span>}
                  </div>
                  {progress.currentFile && (
                    <p className="text-[10px] text-text-ghost font-mono truncate">{progress.currentFile}</p>
                  )}
                </>
              )}
            </div>
          )}

          {state === "done" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
                <CheckCircle2 size={16} className="text-success mt-0.5 flex-shrink-0" />
                <div className="text-sm text-success">
                  <p className="font-medium">Import complete</p>
                  <p className="mt-1 text-xs opacity-80">
                    {progress.uploaded} file{progress.uploaded !== 1 ? "s" : ""} uploaded
                    {progress.failed > 0 && `, ${progress.failed} failed`}
                    {studies.length > 0 && ` — ${studies.length} ${studies.length === 1 ? "study" : "studies"}`}
                  </p>
                </div>
              </div>

              {/* Study summaries with thumbnails */}
              {studies.length > 0 && (
                <div className="space-y-3">
                  {studies.map((s) => (
                    <div
                      key={s.orthancId}
                      className="flex gap-3 rounded-lg border border-border-default bg-surface-base p-3"
                    >
                      {/* Thumbnail */}
                      <div className="w-20 h-20 rounded bg-surface-overlay overflow-hidden flex-shrink-0">
                        {s.thumbnailInstanceId ? (
                          <img
                            src={`/orthanc/instances/${s.thumbnailInstanceId}/frames/0/preview`}
                            alt="DICOM preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-ghost">
                            <FileUp size={24} />
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {s.patientName || "Unknown Patient"}
                        </p>
                        {s.studyDescription && (
                          <p className="text-xs text-text-muted truncate mt-0.5">{s.studyDescription}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-text-ghost">
                          {s.studyDate && <span>{s.studyDate}</span>}
                          <span>{s.seriesCount} series</span>
                          <span className="font-mono">{s.orthancId.substring(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {state === "error" && (
            <div className="flex items-start gap-3 rounded-lg border border-critical/30 bg-critical/10 px-4 py-3">
              <AlertCircle size={16} className="text-critical mt-0.5 flex-shrink-0" />
              <div className="text-sm text-critical">
                <p className="font-medium">Import failed</p>
                <p className="mt-1 text-xs opacity-80">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
          {state === "idle" && (
            <>
              <button
                onClick={handleClose}
                className="rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={uploadFiles}
                disabled={files.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-surface-base hover:bg-info disabled:opacity-40 transition-colors"
              >
                <Upload size={14} />
                Upload {files.length > 0 ? `${files.length} files` : ""}
              </button>
            </>
          )}
          {(state === "done" || state === "error") && (
            <button
              onClick={handleClose}
              className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-surface-base hover:bg-info transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDicomDate(raw: string): string {
  if (!raw || raw.length !== 8) return raw;
  return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
}
