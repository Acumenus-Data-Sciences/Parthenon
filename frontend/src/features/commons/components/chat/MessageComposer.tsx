import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Bold, Italic, Code, Paperclip, Link, X } from "lucide-react";
import type { ChannelMember, ObjectSearchResult } from "../../types";
import { avatarColor } from "../../utils/avatarColor";
import { ReferencePicker } from "./ReferencePicker";

interface MessageComposerProps {
  channelName: string;
  onSend: (body: string, references?: { type: string; id: number; name: string }[]) => void;
  disabled?: boolean;
  onKeyDown?: () => void;
  members?: ChannelMember[];
}

export function MessageComposer({ channelName, onSend, disabled, onKeyDown, members = [] }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Object references state
  const [attachedRefs, setAttachedRefs] = useState<ObjectSearchResult[]>([]);
  const [showRefPicker, setShowRefPicker] = useState(false);

  // @mentions state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);

  const mentionResults = mentionQuery !== null
    ? members.filter((m) =>
        m.user.name.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery]);

  function handleChange(value: string) {
    setBody(value);

    const ta = textareaRef.current;
    if (!ta) return;

    const cursor = ta.selectionStart;
    const textBeforeCursor = value.slice(0, cursor);

    // Detect @mention trigger: @ at start or after whitespace
    const match = textBeforeCursor.match(/(^|\s)@(\w*)$/);
    if (match) {
      setMentionQuery(match[2]);
      setMentionStart(cursor - match[2].length - 1); // position of @
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(member: ChannelMember) {
    const before = body.slice(0, mentionStart);
    const after = body.slice(mentionStart + (mentionQuery?.length ?? 0) + 1);
    const newBody = `${before}@${member.user.name} ${after}`;
    setBody(newBody);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = mentionStart + member.user.name.length + 2;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    });
  }

  function handleAddRef(result: ObjectSearchResult) {
    if (!attachedRefs.some((r) => r.type === result.type && r.id === result.id)) {
      setAttachedRefs((prev) => [...prev, result]);
    }
    setShowRefPicker(false);
    textareaRef.current?.focus();
  }

  function handleRemoveRef(type: string, id: number) {
    setAttachedRefs((prev) => prev.filter((r) => !(r.type === type && r.id === id)));
  }

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    const refs = attachedRefs.length > 0
      ? attachedRefs.map((r) => ({ type: r.type, id: r.id, name: r.name }))
      : undefined;
    onSend(trimmed, refs);
    setBody("");
    setAttachedRefs([]);
    setMentionQuery(null);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Handle mention navigation
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, mentionResults.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

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
      <div className="relative rounded-lg border border-border bg-[#1a1a22] p-3">
        <div className="text-xs text-muted-foreground mb-2">
          Message #{channelName} — Markdown supported
        </div>

        {/* Attached reference pills */}
        {attachedRefs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {attachedRefs.map((ref) => (
              <span
                key={`${ref.type}-${ref.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
              >
                {ref.name}
                <button
                  onClick={() => handleRemoveRef(ref.type, ref.id)}
                  className="ml-0.5 rounded-full hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Reference picker popup */}
        {showRefPicker && (
          <ReferencePicker
            onSelect={handleAddRef}
            onClose={() => setShowRefPicker(false)}
          />
        )}

        {/* @mention autocomplete dropdown */}
        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-border bg-card py-1 shadow-lg z-20">
            {mentionResults.map((member, i) => (
              <button
                key={member.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(member);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm ${
                  i === mentionIndex ? "bg-muted text-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                  style={{ backgroundColor: avatarColor(member.user_id) }}
                >
                  {member.user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <span>{member.user.name}</span>
                {member.role !== "member" && (
                  <span className="ml-auto text-[10px] text-muted-foreground">{member.role}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleChange(e.target.value)}
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
            <ToolbarButton icon={Link} title="Reference object" onClick={() => setShowRefPicker(!showRefPicker)} />
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
