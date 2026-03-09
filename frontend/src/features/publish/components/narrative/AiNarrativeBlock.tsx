import { Sparkles, Loader2, Check, RotateCcw, Pencil } from "lucide-react";
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
  if (narrativeState === "idle") {
    return (
      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[#232328] rounded-lg text-sm text-[#5A5650] hover:border-[#C9A227] hover:text-[#C9A227] transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Generate AI Draft
      </button>
    );
  }

  if (narrativeState === "generating" || isGenerating) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-[#151518] border border-[#232328] rounded-lg">
        <Loader2 className="w-4 h-4 text-[#C9A227] animate-spin" />
        <span className="text-sm text-[#5A5650]">Generating narrative...</span>
      </div>
    );
  }

  if (narrativeState === "draft") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/30 text-amber-400 border border-amber-700/30">
            AI Draft
          </span>
        </div>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={6}
          className="w-full bg-[#151518] border border-[#232328] rounded-lg px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:outline-none focus:border-[#C9A227] resize-y"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#232328] text-sm text-[#F0EDE8] rounded-lg hover:bg-[#232328] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Regenerate
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
          Accepted
        </span>
      </div>
      <div className="bg-[#151518] border border-[#232328] rounded-lg px-3 py-2 text-sm text-[#F0EDE8] whitespace-pre-wrap">
        {content}
      </div>
      <button
        type="button"
        onClick={() => onContentChange(content)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-[#232328] text-sm text-[#F0EDE8] rounded-lg hover:bg-[#232328] transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </button>
    </div>
  );
}
