import { useEffect, useRef, useState } from "react";
import { Bot, Maximize2, Send, User } from "lucide-react";
import type { WikiChatMessage } from "../../types/wiki";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function WikiChatPanel({
  messages, loading, onSend, onNavigate, onExpandChat, currentPageTitle,
}: {
  messages: WikiChatMessage[];
  loading: boolean;
  onSend: (question: string) => void;
  onNavigate: (slug: string) => void;
  onExpandChat?: () => void;
  currentPageTitle?: string | null;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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
    <div className="border-t border-[#232328] bg-[#151518]">
      {/* Messages (collapsed when empty, expands with content) */}
      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-[240px] overflow-y-auto border-b border-[#232328] px-5 py-3">
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2.5">
                <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user" ? "bg-[#1A1A1E]" : "bg-[#2DD4BF]/10"
                }`}>
                  {msg.role === "user"
                    ? <User size={12} className="text-[#8A857D]" />
                    : <Bot size={12} className="text-[#2DD4BF]" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  {msg.role === "user" ? (
                    <p className="text-sm text-[#F0EDE8]">{msg.content}</p>
                  ) : (
                    <div className="text-sm text-[#C5C0B8]">
                      <MarkdownRenderer markdown={msg.content} onNavigate={onNavigate} />
                    </div>
                  )}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {msg.citations.map((c) => (
                        <button key={c.slug} type="button" onClick={() => onNavigate(c.slug)}
                          className="rounded border border-[#232328] bg-[#1A1A1E] px-2 py-0.5 text-[10px] text-[#8A857D] transition-colors hover:border-[#2DD4BF]/30 hover:text-[#2DD4BF]"
                        >
                          {c.title.slice(0, 40)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#2DD4BF]/10">
                  <Bot size={12} className="animate-pulse text-[#2DD4BF]" />
                </div>
                <p className="text-sm text-[#5A5650]">Searching wiki...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-3 px-5 py-3">
        <Bot size={16} className="flex-shrink-0 text-[#2DD4BF]" />
        <div className="min-w-0 flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentPageTitle ? `Ask about "${currentPageTitle.slice(0, 40)}"...` : "Ask the knowledge base..."}
            className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] outline-none transition-colors focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40"
          />
          {currentPageTitle && (
            <p className="mt-1 pl-1 text-[10px] text-[#5A5650]">
              Abby is scoped to this paper and its related wiki pages.
            </p>
          )}
        </div>
        {onExpandChat && (
          <button
            type="button"
            onClick={onExpandChat}
            className="rounded-lg border border-[#232328] bg-[#151518] p-2 text-[#8A857D] transition-colors hover:text-[#2DD4BF]"
            title="Expand chat"
          >
            <Maximize2 size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || input.trim().length < 3}
          className="flex items-center justify-center rounded-lg bg-[#2DD4BF] px-3 py-2 text-[#0E0E11] transition-colors hover:bg-[#26B8A5] disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
