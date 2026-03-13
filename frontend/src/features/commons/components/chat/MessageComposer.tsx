import { useState, useRef, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface MessageComposerProps {
  channelName: string;
  onSend: (body: string) => void;
  disabled?: boolean;
}

export function MessageComposer({ channelName, onSend, disabled }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setBody("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t border-border px-5 py-3">
      <div className="rounded-lg border border-border bg-muted p-3">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName} — Markdown supported`}
          rows={2}
          disabled={disabled}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            **bold** *italic* `code` — Shift+Enter for new line
          </p>
          <button
            onClick={handleSubmit}
            disabled={disabled || !body.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
