import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X } from "lucide-react";

export function WikiIngestModal({
  workspace,
  loading,
  onSubmit,
  onClose,
}: {
  workspace: string;
  loading: boolean;
  onSubmit: (payload: {
    title?: string;
    rawContent?: string;
    file?: File | null;
  }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("commons");
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border-default bg-surface-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default bg-surface-overlay px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-text-primary">
              {t("wiki.ingestModal.title")}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {t("wiki.ingestModal.intro", { workspace })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          <div className="rounded-lg border border-border-default bg-surface-base p-3">
            <p className="text-xs leading-5 text-text-secondary">
              {t("wiki.ingestModal.description")}
            </p>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("wiki.ingestModal.titlePlaceholder")}
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-ghost outline-none transition-colors focus:border-success focus:ring-1 focus:ring-success/40"
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
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border-default bg-surface-base text-text-muted hover:text-text-secondary"
              }`}
            >
              {t("wiki.ingestModal.uploadPaper")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("text");
                setFile(null);
              }}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                mode === "text"
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border-default bg-surface-base text-text-muted hover:text-text-secondary"
              }`}
            >
              {t("wiki.ingestModal.pasteText")}
            </button>
          </div>

          {mode === "text" ? (
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder={t("wiki.ingestModal.textPlaceholder")}
              rows={10}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-ghost outline-none transition-colors focus:border-success focus:ring-1 focus:ring-success/40"
            />
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface-highlight bg-surface-base px-3 py-4 text-sm text-text-muted transition-colors hover:border-text-ghost">
              <Upload size={16} />
              <span>{file ? file.name : t("wiki.ingestModal.attachFile")}</span>
              <input
                type="file"
                className="hidden"
                accept=".md,.markdown,.txt,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          <p className="text-[11px] leading-5 text-text-ghost">
            {t("wiki.ingestModal.help")}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border-default px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary"
          >
            {t("wiki.ingestModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="flex-1 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success-dark disabled:opacity-50"
          >
            {loading
              ? t("wiki.ingestModal.ingesting")
              : t("wiki.ingestModal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
