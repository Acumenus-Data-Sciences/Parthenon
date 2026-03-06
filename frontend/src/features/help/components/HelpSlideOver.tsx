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
          <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
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
          <p className="text-sm leading-relaxed text-[#C5C0B8]">
            {data.description}
          </p>

          {/* Tips */}
          {data.tips.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
                <Lightbulb size={13} />
                Tips
              </div>
              <ul className="space-y-2">
                {data.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2DD4BF]/15 text-xs font-semibold text-[#2DD4BF]">
                      {i + 1}
                    </span>
                    <span className="text-sm text-[#8A857D]">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-col gap-2 border-t border-[#1E1E24] pt-4">
            {data.docs_url && (
              <button
                type="button"
                onClick={() => window.open(data.docs_url, "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-2 text-sm text-[#2DD4BF] hover:text-[#26B8A5] transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-2 text-sm text-[#2DD4BF] hover:text-[#26B8A5] transition-colors"
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
