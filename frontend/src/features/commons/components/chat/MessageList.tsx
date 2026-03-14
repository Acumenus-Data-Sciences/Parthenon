import { useEffect, useRef } from "react";
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
}

export function MessageList({
  messages,
  isLoading,
  slug,
  currentUserId,
  isAdmin = false,
  isTyping = false,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

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

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  // Messages come from API in descending order — reverse for display
  const sorted = [...messages].reverse();

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {sorted.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="rounded-full bg-white/[0.03] p-5">
            <Hash className="h-8 w-8 text-muted-foreground/20" />
          </div>
          <div className="text-center">
            <p className="text-[13px] text-muted-foreground/70">No messages yet</p>
            <p className="text-[11px] text-muted-foreground/40 mt-1">Be the first to say something</p>
          </div>
        </div>
      ) : (
        <div className="py-4 space-y-1">
          {sorted.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              slug={slug}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
      <TypingIndicator isTyping={isTyping} />
      <div ref={bottomRef} />
    </div>
  );
}
