import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Upload, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { uploadFile } from "../api/ingestionApi";
import { FileUploadZone } from "../components/FileUploadZone";
import type { Source } from "@/types/models";

export default function UploadPage() {
  const navigate = useNavigate();
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, sourceId }: { file: File; sourceId: number }) =>
      uploadFile(file, sourceId),
    onSuccess: (job) => {
      navigate(`/ingestion/jobs/${job.id}`);
    },
  });

  const canUpload = selectedFile && selectedSource && !uploadMutation.isPending;

  const handleUpload = () => {
    if (!selectedFile || !selectedSource) return;
    uploadMutation.mutate({
      file: selectedFile,
      sourceId: selectedSource.id,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/ingestion"
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1C1C20] transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Upload Source File
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Select a data source and upload a file to begin profiling
          </p>
        </div>
      </div>

      {/* Source Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#C5C0B8]">
          Data Source
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={sourcesLoading}
            className={cn(
              "flex items-center justify-between w-full rounded-lg border bg-[#151518] px-4 py-2.5 text-sm text-left transition-colors",
              dropdownOpen
                ? "border-[#9B1B30]"
                : "border-[#232328] hover:border-[#323238]",
              sourcesLoading && "opacity-50 cursor-not-allowed",
            )}
          >
            <span className={selectedSource ? "text-[#F0EDE8]" : "text-[#5A5650]"}>
              {sourcesLoading
                ? "Loading sources..."
                : selectedSource
                  ? selectedSource.source_name
                  : "Select a data source"}
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "text-[#8A857D] transition-transform",
                dropdownOpen && "rotate-180",
              )}
            />
          </button>

          {dropdownOpen && sources && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#232328] bg-[#1C1C20] shadow-lg overflow-hidden">
              {sources.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[#8A857D]">
                  No sources available
                </div>
              ) : (
                sources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => {
                      setSelectedSource(source);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "flex flex-col w-full px-4 py-2.5 text-left text-sm hover:bg-[#232328] transition-colors",
                      selectedSource?.id === source.id && "bg-[#232328]",
                    )}
                  >
                    <span className="font-medium text-[#F0EDE8]">
                      {source.source_name}
                    </span>
                    <span className="text-xs text-[#8A857D] font-['IBM_Plex_Mono',monospace]">
                      {source.source_key}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* File Upload Zone */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#C5C0B8]">
          Source File
        </label>
        <FileUploadZone
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
          onRemove={() => setSelectedFile(null)}
        />
      </div>

      {/* Error */}
      {uploadMutation.isError && (
        <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/10 px-4 py-3">
          <p className="text-sm text-[#E85A6B]">
            {uploadMutation.error instanceof Error
              ? uploadMutation.error.message
              : "Upload failed. Please try again."}
          </p>
        </div>
      )}

      {/* Upload Button */}
      <button
        type="button"
        onClick={handleUpload}
        disabled={!canUpload}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors",
          canUpload
            ? "bg-[#9B1B30] text-[#F0EDE8] hover:bg-[#B82D42]"
            : "bg-[#2A2A30] text-[#5A5650] cursor-not-allowed",
        )}
      >
        {uploadMutation.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload size={16} />
            Upload & Profile
          </>
        )}
      </button>
    </div>
  );
}
