import { useState } from "react";
import { Upload, ChevronDown } from "lucide-react";

export function WikiIngestPanel({
  open,
  onToggle,
  workspace,
  loading,
  onSubmit,
}: {
  open: boolean;
  onToggle: () => void;
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
    <div className="rounded-2xl border border-white/[0.06] bg-[#15151a]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Ingest Source</p>
          <p className="text-xs text-muted-foreground">Add markdown, text, or PDF into {workspace}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          <div className="space-y-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional title override"
              className="w-full rounded-xl border border-white/[0.08] bg-[#111115] px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
            />
            <textarea
              value={rawContent}
              onChange={(event) => setRawContent(event.target.value)}
              placeholder="Paste source text or markdown..."
              rows={6}
              className="w-full rounded-xl border border-white/[0.08] bg-[#111115] px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
            />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-[#111115] px-3 py-3 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              <span>{file ? file.name : "Attach a file instead"}</span>
              <input
                type="file"
                className="hidden"
                accept=".md,.markdown,.txt,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || (!rawContent.trim() && !file)}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Ingesting..." : "Ingest source"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
