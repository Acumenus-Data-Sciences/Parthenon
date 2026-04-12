import { useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Hash } from "lucide-react";
import type { Message } from "../../types";
import { MessageItem } from "./MessageItem";
import { TypingIndicator } from "./TypingIndicator";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  slug: string;
  currentUserId: number;
  isAdmin?: boolean;
  isTyping?: boolean;
  lastReadAt?: string | null;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="select-none rounded-full border border-white/[0.06] bg-[#15151a] px-3 py-1 text-[11px] font-medium text-muted-foreground/70">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function UnreadDivider() {
  return (
    <div className="flex items-center gap-3 px-6 py-2">
      <div className="flex-1 h-px bg-red-500/40" />
      <span className="select-none rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-400">
        New messages
      </span>
      <div className="flex-1 h-px bg-red-500/40" />
    </div>
  );
}

export function MessageList({
  messages,
  isLoading,
  slug,
  currentUserId,
  isAdmin = false,
  isTyping = false,
  lastReadAt,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);
  const msgRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight") ? Number(searchParams.get("highlight")) : null;

  const setMsgRef = useCallback((id: number) => (el: HTMLDivElement | null) => {
    if (el) {
      msgRefs.current.set(id, el);
    } else {
      msgRefs.current.delete(id);
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive (if already at bottom)
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const container = containerRef.current;
      if (container) {
        const isAtBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isAtBottom) {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to and briefly highlight the target message from ?highlight= param
  useEffect(() => {
    if (!highlightId || isLoading) return;
    const el = msgRefs.current.get(highlightId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("msg-highlight");
    const timer = setTimeout(() => {
      el.classList.remove("msg-highlight");
      // Remove the param from the URL so refreshing doesn't re-highlight
      setSearchParams((prev) => { prev.delete("highlight"); return prev; }, { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [highlightId, isLoading, setSearchParams]);

  // Messages come from API in descending order — reverse for display
  const sorted = useMemo(() => [...messages].reverse(), [messages]);

  // Find the index where unread messages start
  const unreadIndex = useMemo(() => {
    if (!lastReadAt) return -1;
    const readTime = new Date(lastReadAt).getTime();
    return sorted.findIndex((msg) => new Date(msg.created_at).getTime() > readTime);
  }, [sorted, lastReadAt]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
        <p className="text-sm text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]">
      {sorted.length === 0 ? (
        <div className="flex h-full items-center justify-center p-8">
          <div className="w-full max-w-lg rounded-3xl border border-[#26262c] bg-[#111115] px-8 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2a2a31] bg-[#1a1a20]">
            <Hash className="h-8 w-8 text-muted-foreground/20" />
            </div>
            <div className="mt-4">
              <p className="text-[15px] font-medium text-foreground/85">No messages yet</p>
              <p className="mt-1 text-[12px] leading-6 text-muted-foreground/70">
                Be the first to start the conversation in this channel.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl px-3 py-5">
          {sorted.map((msg, i) => {
            const showDateSep = i === 0 || !isSameDay(sorted[i - 1].created_at, msg.created_at);
            const showUnread = unreadIndex === i && i > 0;

            return (
              <div key={msg.id} ref={setMsgRef(msg.id)}>
                {showDateSep && <DateSeparator label={formatDateLabel(msg.created_at)} />}
                {showUnread && <UnreadDivider />}
                <MessageItem
                  message={msg}
                  slug={slug}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              </div>
            );
          })}
        </div>
      )}
      <TypingIndicator isTyping={isTyping} />
      <div ref={bottomRef} />
    </div>
  );
}
