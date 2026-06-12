import { Sparkles } from "lucide-react";
import { useAbbyDockStore } from "../stores/abbyDockStore";

interface AskAbbyButtonProps {
  /** The question to hand Abby. The dock opens and auto-sends it. */
  prompt: string;
  /** Visible label. Defaults to "Ask Abby". */
  label?: string;
  /** "chip" = small inline pill (default); "ghost" = text-only link. */
  variant?: "chip" | "ghost";
  className?: string;
}

/**
 * Inline affordance that hands a context-specific question to the omnipresent
 * Abby dock. Lets a researcher ask "why is this blocked?" / "summarize this"
 * from a gate card, a result row, or the manuscript without leaving the tab.
 */
export function AskAbbyButton({
  prompt,
  label = "Ask Abby",
  variant = "chip",
  className = "",
}: AskAbbyButtonProps) {
  const openWith = useAbbyDockStore((s) => s.openWith);

  const base =
    variant === "chip"
      ? "inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20 transition-colors"
      : "inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:text-accent/80 transition-colors";

  return (
    <button
      type="button"
      onClick={() => openWith(prompt)}
      className={`${base} ${className}`.trim()}
      title={label}
    >
      <Sparkles size={11} className="shrink-0" />
      {label}
    </button>
  );
}
