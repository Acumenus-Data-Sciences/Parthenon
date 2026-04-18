import { useTranslation } from "react-i18next";
import AbbyAvatar from "./AbbyAvatar";
import type { AbbyTypingIndicatorProps } from "../../types/abby";

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 rounded-full border-[1.5px] border-border border-t-primary animate-spin" />
  );
}

export default function AbbyTypingIndicator({
  pipelineState,
}: AbbyTypingIndicatorProps) {
  const { t } = useTranslation("commons");

  if (pipelineState.stage === "complete") {
    return null;
  }

  if (pipelineState.stage === "error") {
    return (
      <div className="flex gap-2.5 px-4 py-3">
        <AbbyAvatar size="md" />
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3.5 py-2.5">
          <span className="text-[11px] text-red-400">
            {t("abby.typingIndicator.error", {
              message:
                pipelineState.error_message ??
                t("abby.typingIndicator.unknownError"),
            })}
          </span>
        </div>
      </div>
    );
  }

  const label =
    pipelineState.stage === "composing"
      ? t("abby.typingIndicator.replying")
      : t("abby.typingIndicator.thinking");

  return (
    <div className="flex gap-2.5 px-4 py-3">
      <AbbyAvatar size="md" />
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3.5 py-2.5">
        <Spinner />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
