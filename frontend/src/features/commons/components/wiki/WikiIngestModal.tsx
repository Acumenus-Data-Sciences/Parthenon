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

  function handleSubmit() {
    onSubmit({ title: title || undefined, rawContent: rawContent || undefined, file });
    setTitle("");
    setRawContent("");
    setFile(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-[#232328] bg-[#151518] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232328] bg-[#1C1C20] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[#F0EDE8]">Ingest Source</h2>
            <p className="mt-0.5 text-xs text-[#8A857D]">
              Add text, markdown, or a PDF to <span className="font-medium text-[#F0EDE8]">{workspace}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#8A857D] transition-colors hover:text-[#F0EDE8]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional title override"
            className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2.5 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] outline-none transition-colors focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40"
          />
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            placeholder="Paste source text or markdown..."
            rows={8}
            className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2.5 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] outline-none transition-colors focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#323238] bg-[#0E0E11] px-3 py-3 text-sm text-[#8A857D] transition-colors hover:border-[#5A5650]">
            <Upload size={16} />
            <span>{file ? file.name : "Or attach a file (.md, .txt, .pdf)"}</span>
            <input type="file" className="hidden" accept=".md,.markdown,.txt,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-[#232328] px-5 py-4">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2 text-sm text-[#8A857D] transition-colors hover:text-[#C5C0B8]">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading || (!rawContent.trim() && !file)}
            className="flex-1 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5] disabled:opacity-50">
            {loading ? "Ingesting..." : "Ingest"}
          </button>
        </div>
      </div>
    </div>
  );
}
