import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Bold, Italic, Code, Paperclip, Link, X } from "lucide-react";
import type { ChannelMember, ObjectSearchResult } from "../../types";
import { avatarColor } from "../../utils/avatarColor";
import { ReferencePicker } from "./ReferencePicker";
import { dispatchAbbyMentionEvent } from "../abby/AbbyMentionHandler";

interface MessageComposerProps {
  channelName: string;
  onSend: (body: string, references?: { type: string; id: number; name: string }[], files?: File[]) => void;
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

  // File attachments state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const token = `@[${member.user_id}:${member.user.name}] `;
    const newBody = `${before}${token}${after}`;
    setBody(newBody);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = mentionStart + token.length;
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

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  function handleFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Max 10 MB per file
    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024);
    setPendingFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemoveFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    const refs = attachedRefs.length > 0
      ? attachedRefs.map((r) => ({ type: r.type, id: r.id, name: r.name }))
      : undefined;
    const files = pendingFiles.length > 0 ? [...pendingFiles] : undefined;
    onSend(trimmed || "(file attachment)", refs, files);
    // Dispatch @Abby mention event if the message contains @Abby
    if (trimmed) {
      dispatchAbbyMentionEvent(trimmed, "current-user");
    }
    setBody("");
    setAttachedRefs([]);
    setPendingFiles([]);
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
    <div className="border-t border-white/[0.06] bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.18))] px-5 py-4">
      <div className="mx-auto max-w-5xl">
      <div className="relative rounded-[22px] border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.04),transparent_32%),#13131a] p-4 shadow-[0_-8px_28px_rgba(0,0,0,0.18)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Message <span className="font-medium text-foreground">#{channelName}</span> and use Markdown for structure
          </div>
          <div className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Enter to send
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFilesChosen}
          className="hidden"
          accept="image/*,.pdf,.csv,.json,.txt,.xlsx,.docx"
        />

        {/* Pending file pills */}
        {pendingFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {pendingFiles.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-[#2a2a31] bg-[#1a1a20] px-2.5 py-1 text-[11px] text-foreground"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => handleRemoveFile(i)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Attached reference pills */}
        {attachedRefs.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
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
          <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-2xl border border-[#2a2a31] bg-[#17171c] py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
            {mentionResults.map((member, i) => (
              <button
                key={member.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(member);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${
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
          className="min-h-[84px] w-full resize-none bg-transparent text-sm leading-7 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-1.5">
            <ToolbarButton icon={Bold} title="Bold" onClick={() => wrapSelection("**", "**")} />
            <ToolbarButton icon={Italic} title="Italic" onClick={() => wrapSelection("*", "*")} />
            <ToolbarButton icon={Code} title="Code" onClick={() => wrapSelection("`", "`")} />
            <ToolbarButton icon={Link} title="Reference object" onClick={() => setShowRefPicker(!showRefPicker)} />
            <ToolbarButton icon={Paperclip} title="Attach file" onClick={handleFileSelect} />
          </div>
          <button
            onClick={handleSubmit}
            disabled={disabled || (!body.trim() && pendingFiles.length === 0)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/90 hover:shadow-[0_0_16px_rgba(155,27,48,0.35)] disabled:opacity-40"
          >
            Send
          </button>
        </div>
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
      className="rounded-xl border border-[#2a2a31] bg-[#17171c] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
