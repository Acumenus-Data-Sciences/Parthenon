import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AbbyAvatar from "./AbbyAvatar";
import AbbyTypingIndicator from "./AbbyTypingIndicator";
import AbbySourceAttribution from "./AbbySourceAttribution";
import AbbyFeedback from "./AbbyFeedback";
import { useAbbyQuery } from "../../hooks/useAbby";
import {
  fetchAbbyConversation,
  listAbbyConversations,
  submitFeedback,
} from "../../services/abbyService";
import { useAuthStore } from "@/stores/authStore";
import type {
  AbbyConversationMessage,
  AbbyFeedbackRequest,
  AbbyQueryResponse,
  ObjectReference,
} from "../../types/abby";

// ─── Types ──────────────────────────────────────────────────────

interface ConversationEntry {
  id: string;
  role: "user" | "abby";
  content: string;
  timestamp: string;
  userName?: string;
  response?: AbbyQueryResponse;
}

// ─── Suggested Prompts ──────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "What cohort patterns have worked for diabetes studies?",
  "Summarize recent review decisions",
  "What concept sets exist for heart failure?",
  "Help me design a new observational study",
];

// ─── Welcome Card ───────────────────────────────────────────────

function WelcomeCard({
  onPromptClick,
}: {
  onPromptClick: (prompt: string) => void;
}) {
  return (
    <div className="rounded-xl p-5 mb-4 border border-emerald-700/30 bg-gradient-to-br from-emerald-900/15 via-transparent to-teal-900/15 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.1)]">
      <div className="flex items-start gap-3 mb-3">
        <AbbyAvatar size="lg" showStatus />
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Hi! I'm Abby, your research companion.
          </h3>
          <p className="text-[11px] text-emerald-400/80 mt-0.5">
            AI assistant · MedGemma 1.5 · Institutional memory
          </p>
        </div>
      </div>

      <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
        I have access to this network's institutional memory — past discussions,
        cohort designs, study outcomes, review decisions, and wiki articles. Ask
        me anything about your research, and I'll draw on what this team has
        learned.
      </p>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className="px-3 py-1.5 rounded-full text-[11px] text-muted-foreground bg-card border border-border hover:bg-muted hover:border-muted-foreground/30 transition-all duration-150 cursor-pointer"
            onClick={() => onPromptClick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── User Message Bubble ────────────────────────────────────────

function UserBubble({
  entry,
  initials,
}: {
  entry: ConversationEntry;
  initials: string;
}) {
  return (
    <div className="flex gap-2 justify-end">
      <div className="max-w-[80%]">
        <div className="px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-primary/15 text-[13px] text-foreground leading-relaxed">
          {entry.content}
        </div>
        <p className="text-[10px] text-muted-foreground text-right mt-1">
          {formatTime(entry.timestamp)}
          {entry.userName && ` · ${entry.userName}`}
        </p>
      </div>
      <div className="w-7 h-7 rounded-full shrink-0 bg-primary/20 text-primary flex items-center justify-center text-[10px] font-medium">
        {initials}
      </div>
    </div>
  );
}

// ─── Abby Message Bubble ────────────────────────────────────────

function AbbyBubble({
  entry,
  onFeedback,
}: {
  entry: ConversationEntry;
  onFeedback: (feedback: AbbyFeedbackRequest) => void;
}) {
  return (
    <div className="flex gap-2.5">
      <AbbyAvatar size="md" />
      <div className="max-w-[85%] min-w-0">
        {/* Header: Name + AI badge + model + timestamp */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[13px] font-medium text-foreground">Abby</span>
          <span className="text-[9px] px-1.5 py-px rounded bg-emerald-500/15 text-emerald-400 font-medium">
            AI assistant
          </span>
          <span className="text-[10px] text-muted-foreground">
            MedGemma 1.5 · 4B
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatTime(entry.timestamp)}
          </span>
        </div>

        {/* Response body */}
        <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-muted">
          <div className="prose prose-sm prose-invert max-w-none text-[13px] text-foreground leading-relaxed [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_pre]:bg-[#13131a] [&_pre]:border [&_pre]:border-white/[0.06] [&_pre]:rounded-md [&_pre]:p-3 [&_code]:text-teal-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {entry.response ? entry.response.content : entry.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Object references */}
        {entry.response && entry.response.object_references.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.response.object_references.map((ref: ObjectReference) => (
              <button
                key={ref.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/50 bg-muted/50 text-[11px] hover:border-border transition-colors cursor-pointer"
              >
                <span className="text-[9px] opacity-60">◆</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                  {ref.type.replace(/_/g, " ")}
                </span>
                <span className="text-primary font-medium">
                  {ref.display_name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Sources — collapsible with numbered cards and relevance bars */}
        {entry.response && entry.response.sources.length > 0 && (
          <AbbySourceAttribution sources={entry.response.sources} />
        )}

        {/* Feedback — full expansion with categories for negative */}
        {entry.response && (
          <AbbyFeedback messageId={entry.id} onSubmit={onFeedback} />
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function AskAbbyChannel() {
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [hasLoadedConversation, setHasLoadedConversation] = useState(false);
  const { response, pipelineState, isLoading, sendQuery } = useAbbyQuery();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const user = useAuthStore((s) => s.user);
  const userName = user?.name ?? "Researcher";
  const userInitials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    let cancelled = false;

    const loadLatestConversation = async () => {
      try {
        const conversations = await listAbbyConversations();
        const latestCommonsConversation = conversations.find(
          (item) => item.page_context === "commons_ask_abby"
        );

        if (!latestCommonsConversation) {
          if (!cancelled) {
            setHasLoadedConversation(true);
          }
          return;
        }

        const loadedConversation = await fetchAbbyConversation(
          latestCommonsConversation.id
        );

        if (cancelled) {
          return;
        }

        setConversationId(loadedConversation.id);
        setConversation(
          loadedConversation.messages.map((message) =>
            mapConversationMessage(message, userName)
          )
        );
      } catch (error) {
        console.error("Failed to load Ask Abby conversation:", error);
      } finally {
        if (!cancelled) {
          setHasLoadedConversation(true);
        }
      }
    };

    void loadLatestConversation();

    return () => {
      cancelled = true;
    };
  }, [userName]);

  // Auto-scroll on new messages and typing state changes.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [conversation.length, isLoading, pipelineState.stage]);

  // Append Abby's response when query completes
  useEffect(() => {
    if (response) {
      if (typeof response.conversation_id === "number") {
        setConversationId(response.conversation_id);
      }

      setConversation((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "abby",
          content: response.content,
          timestamp: new Date().toISOString(),
          response,
        },
      ]);
    }
  }, [response]);

  const handleSend = useCallback(
    (text?: string) => {
      const query = (text ?? inputValue).trim();
      if (!query || isLoading) return;

      setConversation((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: query,
          timestamp: new Date().toISOString(),
          userName,
        },
      ]);

      setInputValue("");
      inputRef.current?.focus();

      sendQuery({
        query,
        channel_id: "ask-abby",
        channel_name: "ask-abby",
        user_name: userName,
        page_context: "commons_ask_abby",
        conversation_id: conversationId ?? undefined,
      });
    },
    [conversationId, inputValue, isLoading, userName, sendQuery]
  );

  const handleFeedback = useCallback(
    async (feedback: AbbyFeedbackRequest) => {
      try {
        await submitFeedback(feedback);
      } catch (err) {
        console.error("Failed to submit feedback:", err);
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Channel header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] shrink-0 bg-gradient-to-r from-emerald-900/[0.04] to-transparent">
        <AbbyAvatar size="lg" showStatus />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-foreground">Ask Abby</h2>
          <p className="text-[11px] text-muted-foreground">
            AI research companion · MedGemma · Institutional memory
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Online
        </div>
      </div>

      {/* Conversation area */}
      <div
        ref={scrollRef}
        className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {hasLoadedConversation && conversation.length === 0 && (
          <WelcomeCard onPromptClick={(prompt) => handleSend(prompt)} />
        )}

        {conversation.map((entry) =>
          entry.role === "user" ? (
            <UserBubble key={entry.id} entry={entry} initials={userInitials} />
          ) : (
            <AbbyBubble
              key={entry.id}
              entry={entry}
              onFeedback={handleFeedback}
            />
          )
        )}

        {isLoading && (
          <div className="flex gap-2">
            <AbbyAvatar size="sm" />
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-muted">
              <AbbyTypingIndicator pipelineState={pipelineState} />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.06] bg-gradient-to-t from-black/20 to-transparent">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Abby anything about your research network..."
            disabled={isLoading}
            className="flex-1 h-10 px-3.5 text-[13px] bg-[#13131a] border border-white/[0.08] rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 disabled:opacity-60 transition-all duration-150"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="h-10 px-5 rounded-lg text-[13px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer hover:shadow-[0_0_16px_rgba(16,185,129,0.25)]"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapConversationMessage(
  message: AbbyConversationMessage,
  userName: string
): ConversationEntry {
  return {
    id: String(message.id),
    role: message.role === "assistant" ? "abby" : "user",
    content: message.content,
    timestamp: message.created_at,
    userName: message.role === "user" ? userName : undefined,
  };
}
