import { useState } from "react";
import { Download, Loader2, PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpButton } from "@/features/help";
import { useSources } from "@/features/data-sources/hooks/useSources";
import {
  FHIR_RESOURCE_TYPES,
  type FhirResourceType,
} from "../api/fhirExportApi";
import {
  useDownloadFhirExportFile,
  useFhirExportStatus,
  useStartFhirExport,
} from "../hooks/useFhirExport";

// FHIR bulk export is an admin/technical surface; labels are literal (consistent
// with the ExportPanel BUNDLE_FORMATS pattern) to avoid 11-locale i18n churn.
const L = {
  source: "Data source",
  sourcePlaceholder: "Select a source…",
  resourceTypes: "Resource types",
  patientIds: "Patient IDs (optional, comma-separated)",
  start: "Start export",
  starting: "Starting…",
  status: "Export status",
  files: "Files",
  download: "Download",
  noSource: "Select a data source to start an export.",
  failed: "Export failed",
} as const;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-accent/20 text-accent",
  processing: "bg-accent/20 text-accent",
  completed: "bg-success/20 text-success",
  failed: "bg-critical/20 text-critical",
};

export default function FhirExportPage() {
  const { t } = useTranslation("app");
  const { data: sources } = useSources();
  const startExport = useStartFhirExport();
  const downloadFile = useDownloadFhirExportFile();

  const [sourceId, setSourceId] = useState<number | "">("");
  const [selectedTypes, setSelectedTypes] = useState<FhirResourceType[]>([
    ...FHIR_RESOURCE_TYPES,
  ]);
  const [patientIds, setPatientIds] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  const { data: job } = useFhirExportStatus(jobId);

  const toggleType = (type: FhirResourceType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((entry) => entry !== type) : [...prev, type],
    );
  };

  const handleStart = () => {
    if (sourceId === "") return;
    const parsedIds = patientIds
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    startExport.mutate(
      {
        source_id: Number(sourceId),
        resource_types: selectedTypes,
        ...(parsedIds.length > 0 ? { patient_ids: parsedIds } : {}),
      },
      { onSuccess: (response) => setJobId(response.id) },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {t("administration.fhirExport.title")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("administration.fhirExport.subtitle")}
          </p>
        </div>
        <HelpButton helpKey="admin.fhir-export" />
      </div>

      {/* Export request form */}
      <div className="space-y-4 rounded-lg border border-border-default bg-surface-overlay p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            {L.source}
          </label>
          <select
            value={sourceId}
            onChange={(event) =>
              setSourceId(event.target.value === "" ? "" : Number(event.target.value))
            }
            className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
          >
            <option value="">{L.sourcePlaceholder}</option>
            {sources?.map((source) => (
              <option key={source.id} value={source.id}>
                {source.source_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text-secondary">
            {L.resourceTypes}
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FHIR_RESOURCE_TYPES.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 text-xs text-text-primary"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            {L.patientIds}
          </label>
          <input
            type="text"
            value={patientIds}
            onChange={(event) => setPatientIds(event.target.value)}
            placeholder="1001, 1002"
            className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
          />
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={sourceId === "" || startExport.isPending}
          className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-surface-base hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startExport.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PackageOpen size={16} />
          )}
          {startExport.isPending ? L.starting : L.start}
        </button>
        {sourceId === "" && (
          <p className="text-xs text-text-ghost">{L.noSource}</p>
        )}
      </div>

      {/* Status panel */}
      {job && (
        <div className="space-y-3 rounded-lg border border-border-default bg-surface-overlay p-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-primary">{L.status}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLES[job.status] ?? "bg-surface-elevated text-text-muted"
              }`}
            >
              {job.status}
            </span>
            {(job.status === "pending" || job.status === "processing") && (
              <Loader2 size={14} className="animate-spin text-accent" />
            )}
          </div>

          {job.status === "failed" && job.error_message && (
            <p className="text-xs text-critical">
              {L.failed}: {job.error_message}
            </p>
          )}

          {job.status === "completed" && job.files && job.files.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-text-secondary">{L.files}</p>
              <ul className="space-y-1">
                {job.files.map((file) => (
                  <li
                    key={file.resource_type}
                    className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-xs"
                  >
                    <span className="text-text-primary">
                      {file.resource_type} ({file.count})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile.mutate({ id: job.id, file: file.resource_type })
                      }
                      className="flex items-center gap-1 text-success hover:underline"
                    >
                      <Download size={14} />
                      {L.download}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
