import { useState } from "react";
import { Upload, X } from "lucide-react";

export function WikiIngestModal({
  workspace, loading, onSubmit, onClose,
}: {
  workspace: string;
  loading: boolean;
  onSubmit: (payload: { title?: string; rawContent?: string; file?: File | null }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"file" | "text">("file");

  function handleSubmit() {
    onSubmit({
      title: title || undefined,
      rawContent: mode === "text" ? rawContent || undefined : undefined,
      file: mode === "file" ? file : null,
    });
    setTitle("");
    setRawContent("");
    setFile(null);
    setMode("file");
  }

  const hasText = rawContent.trim().length > 0;
  const canSubmit = mode === "file" ? Boolean(file) : hasText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-[#232328] bg-[#151518] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232328] bg-[#1C1C20] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[#F0EDE8]">Ingest Source</h2>
            <p className="mt-0.5 text-xs text-[#8A857D]">
              Upload a paper or paste important text into <span className="font-medium text-[#F0EDE8]">{workspace}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#8A857D] transition-colors hover:text-[#F0EDE8]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
            <p className="text-xs leading-5 text-[#C5C0B8]">
              Abby will parse the source into structured wiki pages, embed the knowledge with SapBERT, and make it chat-ready in the Knowledge Base and Commons Abby.
            </p>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional title override"
            className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2.5 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] outline-none transition-colors focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("file");
                setRawContent("");
              }}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                mode === "file"
                  ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                  : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8]"
              }`}
            >
              Upload paper
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("text");
                setFile(null);
              }}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                mode === "text"
                  ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                  : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8]"
              }`}
            >
              Paste text
            </button>
          </div>

          {mode === "text" ? (
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder="Paste source text or markdown..."
              rows={10}
              className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2.5 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] outline-none transition-colors focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40"
            />
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#323238] bg-[#0E0E11] px-3 py-4 text-sm text-[#8A857D] transition-colors hover:border-[#5A5650]">
              <Upload size={16} />
              <span>{file ? file.name : "Attach a file (.md, .txt, .pdf)"}</span>
              <input
                type="file"
                className="hidden"
                accept=".md,.markdown,.txt,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          <p className="text-[11px] leading-5 text-[#5A5650]">
            Use one source per ingest. PDFs are text-extracted, summarized into wiki pages, and embedded with SapBERT for semantic retrieval.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-[#232328] px-5 py-4">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2 text-sm text-[#8A857D] transition-colors hover:text-[#C5C0B8]">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading || !canSubmit}
            className="flex-1 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5] disabled:opacity-50">
            {loading ? "Ingesting..." : "Ingest"}
          </button>
        </div>
      </div>
    </div>
  );
}
