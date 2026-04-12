import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Send, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { WikiChatMessage } from "../../types/wiki";
import { MarkdownRenderer } from "./MarkdownRenderer";
import AbbyAvatar from "../abby/AbbyAvatar";

function UserBubble() {
  const user = useAuthStore((s) => s.user);
  const avatarUrl = user?.avatar ? `/storage/${user.avatar}?v=${user.updated_at ?? ""}` : null;
  const [err, setErr] = useState(false);

  if (avatarUrl && !err) {
    return (
      <img
        src={avatarUrl}
        alt={user?.name ?? ""}
        className="h-6 w-6 rounded-full object-cover"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-overlay">
      <User size={12} className="text-text-muted" />
    </div>
  );
}

export function WikiChatPanel({
  messages, loading, onSend, onNavigate, onExpandChat, currentPageTitle,
  onContentHeightChange,
}: {
  messages: WikiChatMessage[];
  loading: boolean;
  onSend: (question: string) => void;
  onNavigate: (slug: string) => void;
  onExpandChat?: () => void;
  currentPageTitle?: string | null;
  onContentHeightChange?: (height: number) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Report the natural (unconstrained) content height of the messages area
  // so the parent layout can allocate the right amount of space.
  useEffect(() => {
    if (!contentRef.current || !onContentHeightChange) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onContentHeightChange(entry.contentRect.height);
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [onContentHeightChange]);

  // Also report on message changes (ResizeObserver may not fire for content-only changes)
  useEffect(() => {
    if (!contentRef.current || !onContentHeightChange) return;
    // Use requestAnimationFrame to measure after DOM paint
    const frame = requestAnimationFrame(() => {
      if (contentRef.current) {
        onContentHeightChange(contentRef.current.scrollHeight);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, loading, onContentHeightChange]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (trimmed.length < 3 || loading) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleSubmit(); }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border-default bg-surface-raised">
      {/* Messages — scrolls within the space the parent allocates */}
      {messages.length > 0 && (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto border-b border-border-default px-5 py-3">
          <div ref={contentRef} className="space-y-3">
            {messages.map((msg, idx) => {
              const isStreamingMsg = loading && msg.role === "assistant" && idx === messages.length - 1;
              return (
                <div key={msg.id} className="flex gap-2.5">
                  {msg.role === "user" ? (
                    <div className="mt-0.5 flex-shrink-0">
                      <UserBubble />
                    </div>
                  ) : isStreamingMsg ? (
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center">
                      <Loader2 size={16} className="animate-spin text-success" />
                    </div>
                  ) : (
                    <div className="mt-0.5 flex-shrink-0">
                      <AbbyAvatar size="sm" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {msg.role === "user" ? (
                      <p className="text-sm text-text-primary">{msg.content}</p>
                    ) : msg.content ? (
                      <div className="text-sm text-text-secondary">
                        <MarkdownRenderer markdown={msg.content} onNavigate={onNavigate} />
                      </div>
                    ) : isStreamingMsg ? (
                      <p className="text-sm text-text-ghost">Generating response...</p>
                    ) : null}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {msg.citations.map((c) => (
                          <button key={c.slug} type="button" onClick={() => onNavigate(c.slug)}
                            className="rounded border border-border-default bg-surface-overlay px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:border-success/30 hover:text-success"
                          >
                            {c.title.slice(0, 40)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex flex-shrink-0 items-center gap-3 px-5 py-3">
        <div className="flex-shrink-0">
          <AbbyAvatar size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentPageTitle ? `Ask about "${currentPageTitle.slice(0, 40)}"...` : "Ask the knowledge base..."}
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost outline-none transition-colors focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40"
          />
          {currentPageTitle && (
            <p className="mt-1 pl-1 text-[10px] text-text-ghost">
              Abby is scoped to this paper and its related wiki pages.
            </p>
          )}
        </div>
        {onExpandChat && (
          <button
            type="button"
            onClick={onExpandChat}
            className="rounded-lg border border-border-default bg-surface-raised p-2 text-text-muted transition-colors hover:text-success"
            title="Expand chat"
          >
            <Maximize2 size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || input.trim().length < 3}
          className="flex items-center justify-center rounded-lg bg-success px-3 py-2 text-surface-base transition-colors hover:bg-success-dark disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
