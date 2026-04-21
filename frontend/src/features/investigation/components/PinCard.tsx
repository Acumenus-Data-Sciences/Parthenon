import { Star, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EvidenceDomain, EvidencePin } from "../types";

interface PinCardProps {
  pin: EvidencePin;
  onDelete: (id: number) => void;
  onToggleKeyFinding?: (pinId: number, current: boolean) => void;
}

const DOMAIN_BADGE_STYLE: Record<EvidenceDomain, string> = {
  phenotype: "bg-success/10 text-success",
  clinical: "bg-red-950 text-red-400",
  genomic: "bg-yellow-950 text-accent",
  synthesis: "bg-surface-raised text-text-secondary",
  "code-explorer": "bg-info/10 text-info",
};

function extractPayloadSummary(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload);
  if (entries.length === 0) return "Custom finding";
  const [key, value] = entries[0];
  return `${key}: ${String(value)}`;
}

export function PinCard({ pin, onDelete, onToggleKeyFinding }: PinCardProps) {
  const { t } = useTranslation("app");
  const badgeStyle = DOMAIN_BADGE_STYLE[pin.domain];
  const summary =
    Object.keys(pin.finding_payload).length === 0
      ? t("investigation.synthesis.customFinding")
      : extractPayloadSummary(pin.finding_payload);

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-surface-base border border-border-default group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${badgeStyle}`}
          >
            {pin.finding_type.replace(/_/g, " ")}
          </span>
          {onToggleKeyFinding ? (
            <button
              onClick={() => onToggleKeyFinding(pin.id, pin.is_key_finding)}
              title={
                pin.is_key_finding
                  ? t("investigation.synthesis.unmarkKeyFinding")
                  : t("investigation.synthesis.markKeyFinding")
              }
              className="shrink-0 transition-colors hover:opacity-80"
            >
              <Star
                size={11}
                className={
                  pin.is_key_finding
                    ? "text-accent fill-accent"
                    : "text-text-ghost fill-none"
                }
              />
            </button>
          ) : (
            pin.is_key_finding && (
              <Star size={11} className="text-accent fill-accent shrink-0" />
            )
          )}
        </div>
        <p className="text-xs text-text-muted truncate">{summary}</p>
      </div>
      <button
        onClick={() => onDelete(pin.id)}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-text-ghost hover:text-text-secondary"
        aria-label={t("investigation.synthesis.removePin")}
      >
        <X size={13} />
      </button>
    </div>
  );
}
