import { useRef, useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Send, Loader2, Trash2, ChevronRight, Clock, MessageSquare, ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAbbyStore } from "@/stores/abbyStore";
import { useAbbyContext } from "@/hooks/useAbbyContext";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/api-client";
import type { Message } from "@/stores/abbyStore";
import type { ConversationSummary } from "@/stores/abbyStore";

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  cohort_builder: [
    "Help me build a cohort for Type 2 diabetes patients on metformin",
    "What inclusion criteria should I use for a new-user study design?",
    "Explain the difference between prevalent and incident cohorts",
  ],
  cohort_list: [
    "What makes a good cohort definition?",
    "How do I compare two cohort definitions?",
    "What is a new-user cohort design?",
  ],
  concept_set_editor: [
    "Should I include descendants for this concept set?",
    "What's the difference between SNOMED and ICD10CM concepts?",
    "Help me find related concepts to add",
  ],
  concept_set_list: [
    "How should I organize my concept sets?",
    "What are best practices for concept set versioning?",
  ],
  data_explorer: [
    "What do these Achilles results tell me about data quality?",
    "How should I interpret the age distribution chart?",
    "What's a healthy observation period distribution?",
  ],
  data_sources: [
    "How do I configure a new OMOP CDM data source?",
    "What are source daimons and why do they matter?",
    "How do I test a database connection?",
  ],
  analyses: [
    "What's the difference between characterization and estimation?",
    "When should I use SCCS vs cohort method?",
    "How do I set up a prediction analysis?",
  ],
  genomics: [
    "How do I interpret variant pathogenicity from ClinVar?",
    "What VCF fields does Parthenon import?",
    "How do I create a genomic cohort criteria?",
  ],
  imaging: [
    "What DICOM modalities are supported?",
    "How do I view a study in the DICOM viewer?",
    "How are imaging features extracted?",
  ],
  heor: [
    "What types of HEOR analyses can I run?",
    "How do I set up a cost-effectiveness analysis?",
    "Explain the difference between CUA and CEA",
  ],
  data_quality: [
    "What do the DQD check categories mean?",
    "How do I interpret a failed plausibility check?",
    "What are Achilles heel rules?",
  ],
  vocabulary: [
    "How do I find the standard concept for a diagnosis code?",
    "What is concept mapping in OMOP?",
    "Explain the OMOP vocabulary hierarchy",
  ],
  incidence_rates: [
    "How do I define time-at-risk for incidence rates?",
    "What's the difference between incidence rate and proportion?",
  ],
  estimation: [
    "What is a propensity score model?",
    "When should I use IPTW vs stratification?",
    "How do I choose negative control outcomes?",
  ],
  prediction: [
    "How do I evaluate a prediction model's performance?",
    "What is LASSO regression in the OHDSI context?",
    "How do I choose features for patient-level prediction?",
  ],
  studies: [
    "How do I organize a multi-site study?",
    "What components should a study protocol include?",
    "How do I manage study lifecycle transitions?",
  ],
  administration: [
    "How do I configure authentication providers?",
    "How do I manage user roles and permissions?",
    "How do I check system health?",
    "How is the ChromaDB knowledge base performing?",
  ],
  patient_profiles: [
    "How do I interpret a patient's clinical timeline?",
    "What OMOP domains appear in patient profiles?",
  ],
  data_ingestion: [
    "What file formats can I upload for ingestion?",
    "How does schema mapping work?",
    "What validation checks are performed on uploaded data?",
  ],
  care_gaps: [
    "What is a care gap measure?",
    "How do I create a care bundle?",
  ],
  dashboard: [
    "What do the dashboard metrics mean?",
    "How do I navigate Parthenon?",
  ],
  general: [
    "What can you help me with?",
    "Explain the OMOP Common Data Model",
    "How do I get started with cohort building?",
    "What documentation do you have about cohort building?",
  ],
};

const CONTEXT_LABELS: Record<string, string> = {
  cohort_builder: "Cohort Builder",
  cohort_list: "Cohort Definitions",
  concept_set_editor: "Concept Set Editor",
  concept_set_list: "Concept Sets",
  data_explorer: "Data Explorer",
  data_sources: "Data Sources",
  analyses: "Analyses",
  genomics: "Genomics",
  imaging: "Imaging",
  heor: "Health Economics",
  data_quality: "Data Quality",
  vocabulary: "Vocabulary",
  incidence_rates: "Incidence Rates",
  estimation: "Estimation",
  prediction: "Prediction",
  studies: "Studies",
  administration: "Administration",
  patient_profiles: "Patient Profiles",
  data_ingestion: "Data Ingestion",
  care_gaps: "Care Gaps",
  dashboard: "Dashboard",
  general: "General",
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function AbbyPanel() {
  const { panelOpen, setPanelOpen, messages, addMessage, clearMessages, pageContext, isStreaming, setIsStreaming, streamingContent, setStreamingContent, appendStreamingContent, conversationId, setConversationId, conversationList, setConversationList } = useAbbyStore();
  const { pageName } = useAbbyContext();
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom on new messages or streaming
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (panelOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [panelOpen]);

  // Escape to close
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen, setPanelOpen]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  }, [input]);

  // Fetch conversation list when panel opens
  useEffect(() => {
    if (!panelOpen || !user) return;
    const fetchConversations = async () => {
      try {
        const { data } = await apiClient.get<{ data: ConversationSummary[] }>(
          "/abby/conversations?per_page=20"
        );
        setConversationList(data.data);
      } catch {
        // Silently fail — conversations are non-critical
      }
    };
    fetchConversations();
  }, [panelOpen, user, setConversationList]);

  const loadConversation = useCallback(
    async (conv: ConversationSummary) => {
      setHistoryLoading(true);
      try {
        const { data } = await apiClient.get<{
          data: {
            id: number;
            title: string;
            messages: { id: number; role: "user" | "assistant"; content: string; metadata: unknown; created_at: string }[];
          };
        }>(`/abby/conversations/${conv.id}`);
        const loaded: Message[] = data.data.messages.map((m) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        }));
        // Replace messages in store
        useAbbyStore.setState({ messages: loaded });
        setConversationId(data.data.id);
        setHistoryOpen(false);
      } catch {
        // Failed to load conversation
      } finally {
        setHistoryLoading(false);
      }
    },
    [setConversationId],
  );

  const deleteConversation = useCallback(
    async (convId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await apiClient.delete(`/abby/conversations/${convId}`);
        setConversationList(conversationList.filter((c) => c.id !== convId));
        // If the deleted conversation is the active one, clear it
        if (conversationId === convId) {
          clearMessages();
        }
      } catch {
        // Failed to delete
      }
    },
    [conversationList, conversationId, setConversationList, clearMessages],
  );

  const sendMessage = useCallback(
    async (text?: string) => {
      const msgText = (text ?? input).trim();
      if (!msgText || isStreaming) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: msgText,
        timestamp: new Date(),
      };
      addMessage(userMsg);
      setInput("");
      setIsStreaming(true);
      setStreamingContent("");

      const history = messages
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const abortController = new AbortController();
      abortRef.current = abortController;

      // Determine conversation_id from store
      const currentConversationId = useAbbyStore.getState().conversationId;
      // Auto-title: use first 50 chars of first user message if this is a new conversation
      const isFirstMessage = !currentConversationId;
      const autoTitle = isFirstMessage ? msgText.slice(0, 50) : undefined;

      try {
        // Try streaming first
        const currentToken = useAuthStore.getState().token;
        const response = await fetch("/api/v1/abby/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            message: msgText,
            page_context: pageContext,
            history,
            user_profile: user
              ? { name: user.name, roles: user.roles ?? [] }
              : undefined,
            ...(currentConversationId ? { conversation_id: currentConversationId } : {}),
            ...(autoTitle ? { title: autoTitle } : {}),
          }),
          signal: abortController.signal,
        });

        if (response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
          // SSE streaming
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";
          let suggestions: string[] = [];

          if (reader) {
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data) as {
                      token?: string;
                      suggestions?: string[];
                      conversation_id?: number;
                      error?: string;
                    };
                    if (parsed.token) {
                      fullContent += parsed.token;
                      appendStreamingContent(parsed.token);
                    }
                    if (parsed.suggestions) {
                      suggestions = parsed.suggestions;
                    }
                    if (parsed.conversation_id && !useAbbyStore.getState().conversationId) {
                      setConversationId(parsed.conversation_id);
                    }
                  } catch {
                    // skip non-JSON lines
                  }
                }
              }
            }
          }

          addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: fullContent || "I received your message but couldn't generate a response.",
            timestamp: new Date(),
            suggestions,
          });
        } else {
          // Fallback to non-streaming
          const { data } = await apiClient.post<{
            reply: string;
            suggestions: string[];
            conversation_id?: number;
          }>("/abby/chat", {
            message: msgText,
            page_context: pageContext,
            history,
            user_profile: user
              ? { name: user.name, roles: user.roles ?? [] }
              : undefined,
            ...(currentConversationId ? { conversation_id: currentConversationId } : {}),
            ...(autoTitle ? { title: autoTitle } : {}),
          });

          if (data.conversation_id && !useAbbyStore.getState().conversationId) {
            setConversationId(data.conversation_id);
          }

          addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              data.reply ??
              "I received your message but couldn't generate a response.",
            timestamp: new Date(),
            suggestions: data.suggestions,
          });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // If streaming failed, try non-streaming fallback
        try {
          const { data } = await apiClient.post<{
            reply: string;
            suggestions: string[];
            conversation_id?: number;
          }>("/abby/chat", {
            message: msgText,
            page_context: pageContext,
            history,
            user_profile: user
              ? { name: user.name, roles: user.roles ?? [] }
              : undefined,
            ...(currentConversationId ? { conversation_id: currentConversationId } : {}),
            ...(autoTitle ? { title: autoTitle } : {}),
          });

          if (data.conversation_id && !useAbbyStore.getState().conversationId) {
            setConversationId(data.conversation_id);
          }

          addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply ?? "I received your message but couldn't generate a response.",
            timestamp: new Date(),
            suggestions: data.suggestions,
          });
        } catch {
          addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Unable to connect to the AI service. Please check that the service is running.",
            timestamp: new Date(),
          });
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [input, isStreaming, messages, pageContext, user, addMessage, setIsStreaming, setStreamingContent, appendStreamingContent, setConversationId],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const contextLabel = CONTEXT_LABELS[pageContext] ?? pageName;
  const suggestions = CONTEXT_SUGGESTIONS[pageContext] ?? CONTEXT_SUGGESTIONS.general;
  const showSuggestions = messages.length <= 1;
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant" && m.suggestions?.length);

  if (!panelOpen) return null;

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={() => setPanelOpen(false)} />
      <div className="drawer drawer-lg" role="dialog" aria-label="AI Assistant">
        {/* Header */}
        <div className="ai-panel-header">
          <Sparkles size={18} style={{ color: "var(--accent)" }} />
          <div style={{ flex: 1 }}>
            <span className="text-panel-title">Abby AI</span>
            <span
              style={{
                marginLeft: 8,
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                background: "var(--surface-overlay)",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-default)",
              }}
            >
              {contextLabel}
            </span>
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-label="Conversation history"
            title="Conversation history"
          >
            <Clock size={14} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => { clearMessages(); setHistoryOpen(false); }}
            aria-label="New chat"
            title="New chat"
          >
            <Trash2 size={14} />
          </button>
          <button
            className="modal-close"
            onClick={() => setPanelOpen(false)}
            aria-label="Close AI panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* History Sidebar */}
        {historyOpen && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: "100%",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              background: "#0E0E11",
            }}
          >
            {/* History header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-default)",
                flexShrink: 0,
              }}
            >
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setHistoryOpen(false)}
                aria-label="Back to chat"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                Conversation History
              </span>
            </div>

            {/* History list */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "8px 0",
              }}
            >
              {conversationList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--text-muted)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  No past conversations
                </div>
              ) : (
                conversationList.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 16px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-default)",
                      transition: "background 0.15s",
                      background: conversationId === conv.id ? "var(--surface-overlay)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-overlay)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        conversationId === conv.id ? "var(--surface-overlay)" : "transparent";
                    }}
                  >
                    <MessageSquare size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {conv.title || "Untitled"}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {formatRelativeTime(conv.created_at)}
                        {conv.messages_count > 0 && ` · ${conv.messages_count} msgs`}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      aria-label="Delete conversation"
                      title="Delete conversation"
                      style={{ flexShrink: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
              {historyLoading && (
                <div style={{ textAlign: "center", padding: 16 }}>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="ai-panel-body" ref={bodyRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.role === "user" ? "ai-bubble-user" : "ai-bubble-model"
              }
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          ))}

          {/* Streaming content */}
          {isStreaming && streamingContent && (
            <div className="ai-bubble-model">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingContent}
              </ReactMarkdown>
              <span className="ai-cursor" />
            </div>
          )}

          {/* Loading indicator */}
          {isStreaming && !streamingContent && (
            <div className="ai-bubble-model">
              <Loader2
                size={16}
                style={{ animation: "spin 1s linear infinite" }}
              />
            </div>
          )}

          {/* Suggestion chips from last response */}
          {!isStreaming && lastAssistantMsg?.suggestions && lastAssistantMsg.suggestions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
              {lastAssistantMsg.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    background: "var(--surface-overlay)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    padding: "4px 10px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Initial suggestions based on page context */}
          {showSuggestions && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Suggested prompts
              </span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    textAlign: "left",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-muted)",
                    background: "var(--surface-overlay)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    padding: "8px 12px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  <ChevronRight size={12} style={{ flexShrink: 0 }} />
                  {s}
                </button>
              ))}
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
              placeholder={`Ask Abby about ${contextLabel.toLowerCase()}...`}
              rows={1}
            />
            <button
              className="ai-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
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
