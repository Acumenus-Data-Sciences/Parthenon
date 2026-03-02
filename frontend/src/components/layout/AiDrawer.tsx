import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Send, Loader2 } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AiDrawer() {
  const { aiDrawerOpen, setAiDrawerOpen } = useUiStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm Abby, your AI research assistant powered by MedGemma. I can help with concept mapping, cohort design, data quality questions, and OMOP CDM guidance. How can I help?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (aiDrawerOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [aiDrawerOpen]);

  // Escape to close
  useEffect(() => {
    if (!aiDrawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAiDrawerOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [aiDrawerOpen, setAiDrawerOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.response ?? data.message ?? "I received your message but couldn't generate a response.",
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Sorry, I encountered an error. The AI service may be unavailable. Please try again later.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Unable to connect to the AI service. Please check that the service is running.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!aiDrawerOpen) return null;

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={() => setAiDrawerOpen(false)} />
      <div className="drawer drawer-lg" role="dialog" aria-label="AI Assistant">
        {/* Header */}
        <div className="ai-panel-header">
          <Sparkles size={18} style={{ color: "var(--accent)" }} />
          <span className="text-panel-title" style={{ flex: 1 }}>Abby AI</span>
          <button
            className="modal-close"
            onClick={() => setAiDrawerOpen(false)}
            aria-label="Close AI drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="ai-panel-body" ref={bodyRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === "user" ? "ai-bubble-user" : "ai-bubble-model"}
            >
              {msg.content}
              {loading && msg === messages[messages.length - 1] && msg.role === "assistant" && (
                <span className="ai-cursor" />
              )}
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="ai-bubble-model">
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="ai-panel-footer">
          <div className="ai-input">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Abby anything about OMOP CDM..."
              rows={1}
            />
            <button
              className="ai-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
