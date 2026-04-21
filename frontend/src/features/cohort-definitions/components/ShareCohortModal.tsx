import { useState } from "react";
import { Copy, CheckCheck, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { shareCohortDefinition, type ShareCohortResult } from "../api/cohortApi";
import { useTranslation } from "react-i18next";

interface Props {
  cohortId: number;
  open: boolean;
  onClose: () => void;
}

export function ShareCohortModal({ cohortId, open, onClose }: Props) {
  const { t } = useTranslation("app");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShareCohortResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build frontend URL from API token
  const frontendUrl = result
    ? `${window.location.origin}/shared/${result.token}`
    : null;

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await shareCohortDefinition(cohortId, days);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!frontendUrl) return;
    await navigator.clipboard.writeText(frontendUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("cohortDefinitions.auto.shareCohort_75eb54")}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            {t("cohortDefinitions.auto.close_d3d2e6")}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {t("cohortDefinitions.auto.generateLink_50a9ec")}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-text-muted">
          {t("cohortDefinitions.auto.generateAReadOnlyLinkToShareThis_4035e3")}
        </p>

        {/* Expiry picker */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            {t("cohortDefinitions.auto.linkExpiresAfter_1daff2")}
          </label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={!!result}
            className="rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-success/50 disabled:opacity-50"
          >
            <option value={7}>{t("cohortDefinitions.auto.7Days_cb8f14")}</option>
            <option value={14}>{t("cohortDefinitions.auto.14Days_0e92d2")}</option>
            <option value={30}>{t("cohortDefinitions.auto.30Days_947d85")}</option>
            <option value={90}>{t("cohortDefinitions.auto.90Days_ed0c9b")}</option>
            <option value={365}>{t("cohortDefinitions.auto.1Year_ca4c73")}</option>
          </select>
        </div>

        {/* Generated link */}
        {result && frontendUrl && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-muted">
              {t("cohortDefinitions.auto.shareLink_50f67a")}
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={frontendUrl}
                className="flex-1 rounded-lg bg-surface-base border border-border-default px-3 py-2 text-xs text-text-secondary focus:outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors shrink-0"
              >
                {copied ? (
                  <CheckCheck size={13} className="text-success" />
                ) : (
                  <Copy size={13} />
                )}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-[10px] text-text-ghost">
              {t("cohortDefinitions.auto.expires_7896bd")}{" "}
              {new Date(result.expires_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        )}

        {error && <p className="text-xs text-critical">{error}</p>}
      </div>
    </Modal>
  );
}
