import { useRef, useState } from "react";
import { X, Upload, Loader2, CheckCircle, AlertCircle, SkipForward } from "lucide-react";
import { importCohortDefinitions, type ImportCohortResult } from "../api/cohortApi";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function ImportCohortModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportCohortResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    setError(null);
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError("Invalid JSON — please check your input.");
      return;
    }

    setLoading(true);
    try {
      const res = await importCohortDefinitions(parsed as never);
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-[#1A1A1F] border border-[#2A2A30] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-base font-semibold text-[#F0EDE8]">
            Import Cohort Definition
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* File upload */}
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1.5">
              Upload JSON file
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
            >
              <Upload size={14} />
              Choose file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Paste JSON */}
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1.5">
              Or paste JSON
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={8}
              placeholder={'{\n  "name": "My Cohort",\n  "expression": { ... }\n}'}
              className="w-full rounded-lg bg-[#0E0E11] border border-[#2A2A30] px-3 py-2 text-xs font-mono text-[#C5C0B8] placeholder:text-[#3A3A42] focus:outline-none focus:border-[#2DD4BF]/50 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-[#E85A6B]">{error}</p>
          )}

          {/* Result summary */}
          {result && (
            <div className="rounded-lg bg-[#0E0E11] border border-[#2A2A30] p-3 space-y-2">
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-[#2DD4BF]">
                  <CheckCircle size={12} />
                  {result.imported} imported
                </span>
                <span className="flex items-center gap-1 text-[#C9A227]">
                  <SkipForward size={12} />
                  {result.skipped} skipped
                </span>
                {result.failed > 0 && (
                  <span className="flex items-center gap-1 text-[#E85A6B]">
                    <AlertCircle size={12} />
                    {result.failed} failed
                  </span>
                )}
              </div>
              {result.results.filter((r) => r.status !== "imported").map((r, i) => (
                <p key={i} className="text-[10px] text-[#8A857D]">
                  <span className={r.status === "skipped" ? "text-[#C9A227]" : "text-[#E85A6B]"}>
                    {r.status === "skipped" ? "↷" : "✗"}
                  </span>{" "}
                  {r.name}: {r.reason}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#2A2A30]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2 text-sm text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !jsonText.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
