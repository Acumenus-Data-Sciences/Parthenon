import { Phone, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CommonsCall } from "../../types";

interface CallBannerProps {
  call: CommonsCall;
  onJoin: () => void;
  onEnd: () => void;
  ending?: boolean;
}

export function CallBanner({ call, onJoin, onEnd, ending = false }: CallBannerProps) {
  const { t } = useTranslation("commons");
  const Icon = call.call_type === "audio" ? Phone : Video;
  const callType = t(`rightPanel.activity.callTypes.${call.call_type}`);

  return (
    <div className="mx-6 mt-4 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {t("call.banner.inProgress", { callType })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("call.banner.startedBy", {
            name: call.started_by_user?.name ?? t("call.banner.fallbackStarter"),
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={onJoin}
        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-medium text-black transition-colors hover:bg-emerald-400"
      >
        {t("call.join")}
      </button>
      <button
        type="button"
        onClick={onEnd}
        disabled={ending}
        className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:opacity-50"
      >
        {ending ? t("call.ending") : t("call.end")}
      </button>
    </div>
  );
}
