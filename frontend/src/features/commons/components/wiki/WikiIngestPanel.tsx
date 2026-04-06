import { useState } from "react";
import { Upload } from "lucide-react";

export function WikiIngestPanel({
  workspace,
  loading,
  onSubmit,
}: {
  workspace: string;
  loading: boolean;
  onSubmit: (payload: { title?: string; rawContent?: string; file?: File | null }) => void;
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Optional title override"
            className="w-full rounded-lg border border-white/[0.08] bg-[#111115] px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
          />
          <textarea
            value={rawContent}
            onChange={(event) => setRawContent(event.target.value)}
            placeholder="Paste source text or markdown..."
            rows={8}
            className="w-full rounded-lg border border-white/[0.08] bg-[#111115] px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-[#111115] px-3 py-3 text-sm text-muted-foreground transition hover:border-white/[0.2]">
            <Upload className="h-4 w-4" />
            <span>{file ? file.name : "Or attach a file (.md, .txt, .pdf)"}</span>
            <input
              type="file"
              className="hidden"
              accept=".md,.markdown,.txt,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      <div className="border-t border-white/[0.06] p-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || (!rawContent.trim() && !file)}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Ingesting..." : `Ingest into ${workspace}`}
        </button>
      </div>
    </div>
  );
}
