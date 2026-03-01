import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number;
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const { bg, text, label } = getScoreStyle(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        bg,
        text,
      )}
    >
      <span className="font-['IBM_Plex_Mono',monospace] tabular-nums">
        {score > 0 ? score.toFixed(2) : "--"}
      </span>
      <span>{label}</span>
    </span>
  );
}

function getScoreStyle(score: number) {
  if (score >= 0.95) {
    return {
      bg: "bg-[#2DD4BF]/20",
      text: "text-[#2DD4BF]",
      label: "High",
    };
  }
  if (score >= 0.7) {
    return {
      bg: "bg-[#E5A84B]/20",
      text: "text-[#E5A84B]",
      label: "Medium",
    };
  }
  if (score > 0) {
    return {
      bg: "bg-[#E85A6B]/20",
      text: "text-[#E85A6B]",
      label: "Low",
    };
  }
  return {
    bg: "bg-[#323238]",
    text: "text-[#5A5650]",
    label: "None",
  };
}
