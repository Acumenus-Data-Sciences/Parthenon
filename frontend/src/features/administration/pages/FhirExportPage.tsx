import { useState } from "react";
import { Download, FileText, Loader2, PackageOpen } from "lucide-react";
import { useStartFhirExport, useFhirExportStatus } from "../api/fhirExportApi";

const RESOURCE_TYPES = [
  "Patient",
  "Condition",
  "Encounter",
  "Observation",
  "MedicationStatement",
  "Procedure",
  "Immunization",
  "AllergyIntolerance",
] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number];

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-[#2DD4BF]/15 text-[#2DD4BF]",
  processing: "bg-blue-400/15 text-blue-400",
  pending: "bg-amber-400/15 text-amber-400",
  failed: "bg-[#E85A6B]/15 text-[#E85A6B]",
};

export default function FhirExportPage() {
  const [sourceId, setSourceId] = useState<number>(1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    ...RESOURCE_TYPES,
  ]);
  const [activeExportId, setActiveExportId] = useState<string | null>(null);

  const startExport = useStartFhirExport();
  const exportStatus = useFhirExportStatus(activeExportId);

  const handleToggleType = (type: ResourceType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleSelectAll = () => {
    setSelectedTypes(
      selectedTypes.length === RESOURCE_TYPES.length
        ? []
        : [...RESOURCE_TYPES],
    );
  };

  const handleExport = () => {
    startExport.mutate(
      { source_id: sourceId, resource_types: selectedTypes },
      {
        onSuccess: (data) => {
          setActiveExportId(data.id);
        },
      },
    );
  };

  const status = exportStatus.data?.status;
  const files = exportStatus.data?.files;
  const isPolling = status === "pending" || status === "processing";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0EDE8]">FHIR Bulk Export</h1>
        <p className="mt-1 text-sm text-[#8A857D]">
          Export OMOP CDM data as FHIR R4 NDJSON files for interoperability.
        </p>
      </div>

      {/* Export Form */}
      <div className="rounded-lg border border-[#232328] bg-[#1a1a1f] p-6">
        <div className="flex items-center gap-2 mb-5">
          <PackageOpen size={16} className="text-[#2DD4BF]" />
          <h2 className="text-sm font-semibold text-[#F0EDE8]">
            Configure Export
          </h2>
        </div>

        {/* Source ID */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
            Source ID
          </label>
          <input
            type="number"
            value={sourceId}
            onChange={(e) => setSourceId(Number(e.target.value))}
            className="w-32 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#2DD4BF] focus:outline-none"
            min={1}
          />
        </div>

        {/* Resource Types */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-medium text-[#8A857D] uppercase tracking-wider">
              Resource Types
            </label>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-[#2DD4BF] hover:text-[#26b8a5] transition-colors"
            >
              {selectedTypes.length === RESOURCE_TYPES.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {RESOURCE_TYPES.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => handleToggleType(type)}
                  className="accent-[#2DD4BF] w-3.5 h-3.5"
                />
                <span className="text-sm text-[#C5C0B8]">{type}</span>
              </label>
            ))}
          </div>
          {selectedTypes.length === 0 && (
            <p className="mt-2 text-xs text-[#E85A6B]">
              Select at least one resource type.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={startExport.isPending || selectedTypes.length === 0}
          className="flex items-center gap-2 rounded bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-black hover:bg-[#26b8a5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {startExport.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <Download size={14} />
              Start Export
            </>
          )}
        </button>

        {startExport.isError && (
          <div className="mt-3 rounded border border-[#E85A6B]/30 bg-[#E85A6B]/10 px-3 py-2 text-xs text-[#E85A6B]">
            Failed to start export. Please try again.
          </div>
        )}
      </div>

      {/* Export Status */}
      {activeExportId && (
        <div className="rounded-lg border border-[#232328] bg-[#1a1a1f] p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-[#2DD4BF]" />
            <h2 className="text-sm font-semibold text-[#F0EDE8]">
              Export Status
            </h2>
            {isPolling && (
              <span className="flex items-center gap-1 ml-auto text-[10px] text-[#8A857D]">
                <Loader2 size={10} className="animate-spin text-[#2DD4BF]" />
                Polling every 3s…
              </span>
            )}
          </div>

          {/* Job ID + Status */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5A5650]">Job ID:</span>
              <code className="text-xs text-[#C5C0B8] font-mono bg-[#0E0E11] px-2 py-0.5 rounded">
                {activeExportId}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5A5650]">Status:</span>
              {exportStatus.isLoading ? (
                <Loader2 size={12} className="animate-spin text-[#2DD4BF]" />
              ) : (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_BADGE[status ?? ""] ?? "bg-[#232328] text-[#8A857D]"
                  }`}
                >
                  {isPolling && (
                    <Loader2
                      size={9}
                      className="inline animate-spin mr-1 -mt-0.5"
                    />
                  )}
                  {status ?? "loading…"}
                </span>
              )}
            </div>
          </div>

          {/* Timestamps */}
          {exportStatus.data && (
            <div className="flex flex-wrap gap-4 text-xs text-[#5A5650] mb-4">
              {exportStatus.data.started_at && (
                <span>
                  Started:{" "}
                  <span className="text-[#8A857D]">
                    {new Date(exportStatus.data.started_at).toLocaleTimeString()}
                  </span>
                </span>
              )}
              {exportStatus.data.finished_at && (
                <span>
                  Finished:{" "}
                  <span className="text-[#8A857D]">
                    {new Date(
                      exportStatus.data.finished_at,
                    ).toLocaleTimeString()}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* Error message */}
          {exportStatus.data?.error_message && (
            <div className="mb-4 rounded border border-[#E85A6B]/30 bg-[#E85A6B]/10 p-3 text-xs text-[#E85A6B] font-mono whitespace-pre-wrap break-all">
              {exportStatus.data.error_message}
            </div>
          )}

          {/* Download Links */}
          {status === "completed" && files && files.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium text-[#8A857D] uppercase tracking-wider">
                Export Files ({files.length})
              </h3>
              <div className="space-y-2">
                {files.map((file) => (
                  <a
                    key={file.resource_type}
                    href={`/api/v1/fhir/$export/${activeExportId}/download/${file.resource_type}`}
                    className="flex items-center justify-between rounded border border-[#232328] bg-[#0E0E11] px-4 py-2.5 text-sm text-[#2DD4BF] hover:border-[#2DD4BF]/50 hover:bg-[#0E0E11]/80 transition-colors group"
                    download={`${file.resource_type}.ndjson`}
                  >
                    <span className="flex items-center gap-2">
                      <Download
                        size={13}
                        className="text-[#5A5650] group-hover:text-[#2DD4BF] transition-colors"
                      />
                      {file.resource_type}.ndjson
                    </span>
                    <span className="text-xs text-[#5A5650]">
                      {file.count.toLocaleString()} resources
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {status === "completed" && (!files || files.length === 0) && (
            <p className="text-xs text-[#5A5650]">
              Export completed but no files were generated.
            </p>
          )}

          {/* Start new export button */}
          <div className="mt-5 pt-4 border-t border-[#232328]">
            <button
              type="button"
              onClick={() => setActiveExportId(null)}
              className="text-xs text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
            >
              ← Start a new export
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
