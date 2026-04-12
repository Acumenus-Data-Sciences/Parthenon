interface TypingIndicatorProps {
  isTyping: boolean;
}

export function TypingIndicator({ isTyping }: TypingIndicatorProps) {
  if (!isTyping) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 pb-2">
      <div className="flex items-center gap-2 rounded-full border border-border-default bg-surface-raised px-3 py-1.5 text-[11px] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
        </div>
        <span>Someone is typing</span>
      </div>
    </div>
  );
}
