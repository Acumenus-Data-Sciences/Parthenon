import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/i18n/format";
import { usePins, useUnpinMessage } from "../../api";

interface PinnedListProps {
  slug: string;
}

export function PinnedList({ slug }: PinnedListProps) {
  const { t } = useTranslation("commons");
  const { data: pins = [], isLoading } = usePins(slug);
  const unpin = useUnpinMessage();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-xs text-muted-foreground">{t("rightPanel.pins.loading")}</p>
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <div className="w-full rounded-2xl border border-dashed border-border-default bg-surface-base px-4 py-6">
          <p className="text-[13px] font-medium text-muted-foreground">
            {t("rightPanel.pins.emptyTitle")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground/60">
            {t("rightPanel.pins.emptyMessage")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-2 p-3">
        {pins.map((pin) => (
          <div
            key={pin.id}
            className="group relative rounded-xl border border-border-default bg-surface-base p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-surface-highlight"
          >
            <div className="line-clamp-3 pr-6 text-xs font-medium leading-5 text-foreground">
              {pin.message.body}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {pin.message.user.name} ·{" "}
              {t("rightPanel.pins.pinnedDate", {
                date: formatDate(pin.pinned_at, { month: "short", day: "numeric" }),
              })}
            </div>
            <button
              onClick={() => unpin.mutate({ slug, pinId: pin.id })}
              title={t("rightPanel.pins.unpin")}
              className="absolute right-2 top-2 shrink-0 rounded-lg p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
