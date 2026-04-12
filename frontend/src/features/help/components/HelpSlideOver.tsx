import { ExternalLink, Lightbulb, Loader2, BookOpen } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useHelp } from "../hooks/useHelp";

interface HelpSlideOverProps {
  helpKey: string | null;
  onClose: () => void;
}

export function HelpSlideOver({ helpKey, onClose }: HelpSlideOverProps) {
  const { data, isLoading, isError } = useHelp(helpKey);

  return (
    <Drawer
      open={!!helpKey}
      onClose={onClose}
      title={data?.title ?? "Help"}
      size="md"
    >
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-success" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Help content could not be loaded.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Description */}
          <p className="text-sm leading-relaxed text-text-secondary">
            {data.description}
          </p>

          {/* Tips */}
          {data.tips.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-ghost">
                <Lightbulb size={13} />
                Tips
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
                onClick={() => window.open(data.docs_url ?? undefined, "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-2 text-sm text-success hover:text-success transition-colors cursor-pointer"
              >
                <BookOpen size={14} />
                Read full documentation
                <ExternalLink size={12} />
              </button>
            )}
            {data.video_url && (
              <a
                href={data.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-success hover:text-success transition-colors"
              >
                <ExternalLink size={14} />
                Watch video tutorial
              </a>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
