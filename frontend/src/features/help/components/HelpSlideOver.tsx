import { ExternalLink, Lightbulb, Loader2, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Drawer } from "@/components/ui/Drawer";
import { useHelp } from "../hooks/useHelp";

interface HelpSlideOverProps {
  helpKey: string | null;
  onClose: () => void;
}

export function HelpSlideOver({ helpKey, onClose }: HelpSlideOverProps) {
  const { t } = useTranslation("help");
  const { data, isLoading, isError } = useHelp(helpKey);

  return (
    <Drawer
      open={!!helpKey}
      onClose={onClose}
      title={data?.title ?? t("title")}
      size="md"
    >
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-success" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {t("loadError")}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {data.fallback_used && (
            <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning">
              {t("fallbackNotice")}
            </div>
          )}

          {/* Description */}
          <p className="text-sm leading-relaxed text-text-secondary">
            {data.description}
          </p>

          {/* Tips */}
          {data.tips.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-ghost">
                <Lightbulb size={13} />
                {t("tips")}
              </div>
              <ul className="space-y-2">
                {data.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs font-semibold text-success">
                      {i + 1}
                    </span>
                    <span className="text-sm text-text-muted">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            {data.docs_url && (
              <button
                type="button"
                onClick={() =>
                  window.open(
                    data.docs_url ?? undefined,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                className="inline-flex items-center gap-2 text-sm text-success hover:text-success-dark transition-colors cursor-pointer"
              >
                <BookOpen size={14} />
                {t("readDocumentation")}
                <ExternalLink size={12} />
              </button>
            )}
            {data.video_url && (
              <a
                href={data.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-success hover:text-success-dark transition-colors"
              >
                <ExternalLink size={14} />
                {t("watchVideo")}
              </a>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
