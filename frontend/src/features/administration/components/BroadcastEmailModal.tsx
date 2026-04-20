import { useState } from "react";
import { X, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBroadcastEmail } from "../hooks/useAdminUsers";

interface BroadcastEmailModalProps {
  userCount: number;
  onClose: () => void;
}

export function BroadcastEmailModal({ userCount, onClose }: BroadcastEmailModalProps) {
  const { t } = useTranslation("app");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const broadcast = useBroadcastEmail();

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) return;
    broadcast.mutate(
      { subject: subject.trim(), body: body.trim() },
      {
        onSuccess: (data) =>
          setResult({
            success: true,
            message: t("administration.broadcastEmail.resultWithRecipients", {
              message: data.message,
              count: data.recipient_count,
            }),
          }),
        onError: (err: unknown) => {
          const msg = err instanceof Error
            ? err.message
            : t("administration.broadcastEmail.unknownError");
          setResult({ success: false, message: msg });
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border-default bg-surface-overlay shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">
            {t("administration.broadcastEmail.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-ghost transition-colors hover:bg-surface-accent hover:text-text-muted"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <p className="text-xs text-text-muted">
            {t("administration.broadcastEmail.descriptionPrefix")}{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-accent">
              {userCount}
            </span>{" "}
            {t("administration.broadcastEmail.descriptionSuffix")}
          </p>

          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {t("administration.broadcastEmail.subject")}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("administration.broadcastEmail.subjectPlaceholder")}
              maxLength={255}
              disabled={broadcast.isPending || !!result}
              className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {t("administration.broadcastEmail.message")}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("administration.broadcastEmail.messagePlaceholder")}
              rows={8}
              maxLength={10000}
              disabled={broadcast.isPending || !!result}
              className="w-full resize-none rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40 transition-colors disabled:opacity-50"
            />
            <p className="mt-1 text-right text-[10px] text-text-ghost">
              {body.length.toLocaleString()} / 10,000
            </p>
          </div>

          {/* Result feedback */}
          {result && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                result.success
                  ? "border-success/30 bg-success/5 text-success"
                  : "border-critical/30 bg-critical/5 text-critical"
              }`}
            >
              {result.success ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border-default px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-muted transition-colors hover:border-surface-highlight hover:text-text-secondary"
          >
            {result
              ? t("administration.broadcastEmail.close")
              : t("administration.broadcastEmail.cancel")}
          </button>
          {!result && (
            <button
              type="button"
              disabled={broadcast.isPending || !subject.trim() || !body.trim()}
              onClick={handleSend}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-base transition-colors hover:bg-accent-dark disabled:opacity-50"
            >
              {broadcast.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t("administration.broadcastEmail.sending")}
                </>
              ) : (
                <>
                  <Send size={14} />
                  {t("administration.broadcastEmail.sendToAll")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
