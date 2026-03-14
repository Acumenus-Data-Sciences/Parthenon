interface ReactionTooltipProps {
  users: { id: number; name: string }[];
}

export function ReactionTooltip({ users }: ReactionTooltipProps) {
  if (users.length === 0) return null;

  let text: string;
  if (users.length < 5) {
    text = users.map((u) => u.name).join(", ");
  } else {
    const shown = users.slice(0, 4).map((u) => u.name);
    const remaining = users.length - 4;
    text = `${shown.join(", ")}, and ${remaining} ${remaining === 1 ? "other" : "others"}`;
  }

  return (
    <div className="absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg">
      {text}
    </div>
  );
}
