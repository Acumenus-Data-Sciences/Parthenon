import { useEffect, useRef, useState } from "react";
import { Loader2, Send, User, X } from "lucide-react";
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
        className="h-7 w-7 rounded-full object-cover"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1A1E]">
      <User size={13} className="text-[#8A857D]" />
    </div>
  );
}

const EXAMPLE_PROMPTS = [
  "What are the main approaches to ETL for OMOP CDM?",
  "How is real-world data used for cancer research?",
  "What tools exist for data quality assessment in OHDSI?",
  "Summarize the treatment pathways findings across the network",
];

export function WikiChatDrawer({
  open,
  messages,
  loading,
  onSend,
  onNavigate,
  onClose,
  currentPageTitle,
}: {
  open: boolean;
  messages: WikiChatMessage[];
  loading: boolean;
  onSend: (question: string) => void;
  onNavigate: (slug: string) => void;
  onClose: () => void;
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
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-[480px] max-w-full transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Gradient border */}
        <div className="h-full bg-gradient-to-b from-[#2DD4BF] to-[#A78BFA] p-[1px]">
          <div className="flex h-full flex-col bg-[#0E0E11]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#232328] px-5 py-4">
              <div className="flex items-center gap-3">
                <AbbyAvatar size="md" showStatus />
                <div>
                  <p className="text-sm font-semibold text-[#F0EDE8]">Abby</p>
                  <p className="text-[10px] text-[#8A857D]">
                    {currentPageTitle ? `Scoped to: ${currentPageTitle.slice(0, 50)}` : "Ask questions about ingested knowledge"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#232328] bg-[#151518] p-1.5 text-[#8A857D] transition-colors hover:text-[#F0EDE8]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages / Examples */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <div>
                  <p className="text-xs text-[#5A5650]">Try asking:</p>
                  <div className="mt-3 space-y-2">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => { setInput(prompt); }}
                        className="w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2.5 text-left text-sm text-[#8A857D] transition-colors hover:border-[#2DD4BF]/30 hover:text-[#C5C0B8]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => {
                    const isStreamingMsg = loading && msg.role === "assistant" && idx === messages.length - 1;
                    return (
                      <div key={msg.id} className="flex gap-3">
                        {msg.role === "user" ? (
                          <div className="mt-0.5 flex-shrink-0">
                            <UserBubble />
                          </div>
                        ) : isStreamingMsg ? (
                          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center">
                            <Loader2 size={18} className="animate-spin text-[#2DD4BF]" />
                          </div>
                        ) : (
                          <div className="mt-0.5 flex-shrink-0">
                            <AbbyAvatar size="sm" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 pt-0.5">
                          {msg.role === "user" ? (
                            <p className="text-sm text-[#F0EDE8]">{msg.content}</p>
                          ) : msg.content ? (
                            <div className="text-sm text-[#C5C0B8]">
                              <MarkdownRenderer markdown={msg.content} onNavigate={onNavigate} />
                            </div>
                          ) : isStreamingMsg ? (
                            <p className="text-sm text-[#5A5650]">Generating response...</p>
                          ) : null}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {msg.citations.map((c) => (
                                <button key={c.slug} type="button" onClick={() => { onNavigate(c.slug); onClose(); }}
                                  className="rounded border border-[#232328] bg-[#1A1A1E] px-2 py-0.5 text-[10px] text-[#8A857D] transition-colors hover:border-[#2DD4BF]/30 hover:text-[#2DD4BF]"
                                >
                                  {c.title.slice(0, 50)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[#232328] px-5 py-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the wiki..."
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2.5 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] outline-none transition-colors focus:border-[#2DD4BF]/40"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[10px] text-[#5A5650]">{input.length}/2000 &middot; Ctrl+Enter to send</p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || input.trim().length < 3}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5] disabled:opacity-50"
                >
                  {loading ? (
                    <>Searching...</>
                  ) : (
                    <><Send size={14} /> Ask</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
