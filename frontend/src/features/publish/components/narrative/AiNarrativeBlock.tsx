import { Sparkles, Loader2, Check, RotateCcw, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NarrativeState } from "../../types/publish";

interface AiNarrativeBlockProps {
  content: string;
  narrativeState: NarrativeState;
  onGenerate: () => void;
  onContentChange: (content: string) => void;
  onAccept: () => void;
  isGenerating: boolean;
}

export default function AiNarrativeBlock({
  content,
  narrativeState,
  onGenerate,
  onContentChange,
  onAccept,
  isGenerating,
}: AiNarrativeBlockProps) {
  const { t } = useTranslation("app");
  if (narrativeState === "idle") {
    return (
      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-border-default rounded-lg text-sm text-text-ghost hover:border-accent hover:text-accent transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        {t("publish.aiNarrative.generate")}
      </button>
    );
  }

  if (narrativeState === "generating" || isGenerating) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-raised border border-border-default rounded-lg">
        <Loader2 className="w-4 h-4 text-accent animate-spin" />
        <span className="text-sm text-text-ghost">
          {t("publish.aiNarrative.generating")}
        </span>
      </div>
    );
  }

  if (narrativeState === "draft") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/30 text-amber-400 border border-amber-700/30">
            {t("publish.aiNarrative.draft")}
          </span>
        </div>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={6}
          className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-accent resize-y"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {t("publish.aiNarrative.accept")}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border-default text-sm text-text-primary rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("publish.aiNarrative.regenerate")}
          </button>
        </div>
      </div>
    );
  }

  // accepted
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-700/30">
          {t("publish.aiNarrative.accepted")}
        </span>
      </div>
      <div className="bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary whitespace-pre-wrap">
        {content}
      </div>
      <button
        type="button"
        onClick={() => onContentChange(content)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-border-default text-sm text-text-primary rounded-lg hover:bg-surface-elevated transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        {t("publish.aiNarrative.edit")}
      </button>
    </div>
  );
}
