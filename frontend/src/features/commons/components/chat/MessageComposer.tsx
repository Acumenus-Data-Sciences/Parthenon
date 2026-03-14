import { useState, useRef, type KeyboardEvent } from "react";
import { Bold, Italic, Code, Paperclip } from "lucide-react";

interface MessageComposerProps {
  channelName: string;
  onSend: (body: string) => void;
  disabled?: boolean;
  onKeyDown?: () => void;
}

export function MessageComposer({ channelName, onSend, disabled, onKeyDown }: MessageComposerProps) {
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
    onKeyDown?.();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function wrapSelection(prefix: string, suffix: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    const newBody = body.slice(0, start) + prefix + selected + suffix + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }

  return (
    <div className="border-t border-border px-5 py-3">
      <div className="rounded-lg border border-border bg-[#1a1a22] p-3">
        <div className="text-xs text-muted-foreground mb-2">
          Message #{channelName} — Markdown supported
        </div>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          rows={1}
          disabled={disabled}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">
            <ToolbarButton icon={Bold} title="Bold" onClick={() => wrapSelection("**", "**")} />
            <ToolbarButton icon={Italic} title="Italic" onClick={() => wrapSelection("*", "*")} />
            <ToolbarButton icon={Code} title="Code" onClick={() => wrapSelection("`", "`")} />
            <ToolbarButton icon={Paperclip} title="Attach file" onClick={() => {}} />
          </div>
          <button
            onClick={handleSubmit}
            disabled={disabled || !body.trim()}
            className="rounded bg-primary px-4 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
