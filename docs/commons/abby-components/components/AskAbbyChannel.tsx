/**
 * AskAbbyChannel
 *
 * The dedicated #ask-abby channel — a focused conversational interface
 * for interacting with Abby directly. Features:
 *
 * - Welcome card with suggested prompt chips on first visit
 * - Conversational message layout (user right, Abby left)
 * - Full RAG pipeline indicator during processing
 * - Persistent conversation history via cursor-based pagination
 * - Quick-start chips for common research questions
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import AbbyAvatar from './AbbyAvatar';
import AbbyResponseCard from './AbbyResponseCard';
import AbbyTypingIndicator from './AbbyTypingIndicator';
import { useAbbyQuery } from '../hooks/useAbby';
import { submitFeedback } from '../services/abbyService';
import type {
  AskAbbyChannelProps,
  AbbyFeedbackRequest,
  AbbyQueryResponse,
} from '../types/abby';

// ─── Types ──────────────────────────────────────────────────────

interface ConversationEntry {
  id: string;
  role: 'user' | 'abby';
  content: string;
  timestamp: string;
  userName?: string;
  response?: AbbyQueryResponse;
}

// ─── Suggested Prompts ──────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  'What cohort patterns have worked for diabetes studies?',
  'Summarize recent review decisions',
  'What concept sets exist for heart failure?',
  'Help me design a new observational study',
  'What data quality issues were found last month?',
  'Show me our most-used inclusion criteria patterns',
];

// ─── Welcome Card ───────────────────────────────────────────────

function WelcomeCard({
  onPromptClick,
}: {
  onPromptClick: (prompt: string) => void;
}) {
  return (
    <div
      className="
        bg-gradient-to-br from-emerald-50 to-teal-50
        dark:from-emerald-900/20 dark:to-teal-900/20
        rounded-xl p-5 mb-4
        border border-emerald-100 dark:border-emerald-800/40
      "
    >
      <div className="flex items-center gap-3 mb-3">
        <AbbyAvatar size="lg" />
        <div>
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Hi! I'm Abby, your research companion.
          </h3>
        </div>
      </div>

      <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
        I have access to this network's institutional memory — past discussions,
        cohort designs, study outcomes, review decisions, and wiki articles. Ask
        me anything about your research, and I'll draw on what this team has
        learned.
      </p>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
          <button
            key={prompt}
            className="
              px-3 py-1.5 rounded-full
              text-[11px] text-zinc-600 dark:text-zinc-400
              bg-white/80 dark:bg-zinc-800/80
              border border-zinc-200 dark:border-zinc-700
              hover:bg-white dark:hover:bg-zinc-700
              hover:border-zinc-300 dark:hover:border-zinc-600
              transition-all duration-150 cursor-pointer
            "
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
        <div
          className="
            px-3.5 py-2.5 rounded-2xl rounded-br-sm
            bg-blue-50 dark:bg-blue-900/30
            text-[13px] text-blue-800 dark:text-blue-200
            leading-relaxed
          "
        >
          {entry.content}
        </div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right mt-1">
          {formatTime(entry.timestamp)}
          {entry.userName && ` · ${entry.userName}`}
        </p>
      </div>
      <div
        className="
          w-7 h-7 rounded-full shrink-0
          bg-blue-100 dark:bg-blue-900/40
          text-blue-600 dark:text-blue-400
          flex items-center justify-center
          text-[10px] font-medium
        "
      >
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
  if (!entry.response) {
    return (
      <div className="flex gap-2">
        <AbbyAvatar size="sm" />
        <div className="max-w-[85%]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] px-1.5 py-px rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
              AI
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {formatTime(entry.timestamp)}
            </span>
          </div>
          <div
            className="
              px-3.5 py-2.5 rounded-2xl rounded-bl-sm
              bg-zinc-100 dark:bg-zinc-800
              text-[13px] text-zinc-700 dark:text-zinc-300
              leading-relaxed
            "
          >
            {entry.content}
          </div>
        </div>
      </div>
    );
  }

  // Full response with sources and feedback
  return (
    <div className="flex gap-2">
      <AbbyAvatar size="sm" />
      <div className="max-w-[85%] min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[9px] px-1.5 py-px rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
            AI
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {formatTime(entry.timestamp)}
          </span>
        </div>

        {/* Response body */}
        <div
          className="
            px-3.5 py-2.5 rounded-2xl rounded-bl-sm
            bg-zinc-100 dark:bg-zinc-800
            text-[13px] text-zinc-700 dark:text-zinc-300
            leading-relaxed
          "
        >
          {entry.response.content}
        </div>

        {/* Object references */}
        {entry.response.object_references.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.response.object_references.map((ref) => (
              <button
                key={ref.id}
                className="
                  inline-flex items-center gap-1
                  px-2 py-0.5 rounded-md
                  bg-blue-50 dark:bg-blue-900/20
                  text-[11px] text-blue-600 dark:text-blue-400
                  hover:bg-blue-100 dark:hover:bg-blue-900/30
                  transition-colors duration-150 cursor-pointer
                "
              >
                <span className="text-[9px] opacity-60">◆</span>
                {ref.display_name}
              </button>
            ))}
          </div>
        )}

        {/* Sources */}
        {entry.response.sources.length > 0 && (
          <div className="mt-2 p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1.5">
              Sources from institutional memory
            </p>
            <div className="flex flex-col gap-1">
              {entry.response.sources.slice(0, 4).map((source) => (
                <div
                  key={source.document_id}
                  className="flex items-start gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"
                >
                  <span className="w-1 h-1 rounded-full bg-zinc-400/50 shrink-0 mt-[5px]" />
                  <span className="line-clamp-1">
                    {source.metadata.channel_name && (
                      <span className="text-blue-500 dark:text-blue-400 font-medium">
                        #{source.metadata.channel_name}
                      </span>
                    )}
                    {source.metadata.user_name && ` · ${source.metadata.user_name}`}
                    {source.metadata.created_at && (
                      <span>
                        {' · '}
                        {new Date(source.metadata.created_at).toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric' }
                        )}
                      </span>
                    )}
                    {' — '}
                    <span className="italic">{source.snippet}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback buttons */}
        <div className="flex gap-1.5 mt-2">
          <button
            className="
              px-2 py-0.5 rounded text-[10px]
              text-zinc-400 dark:text-zinc-500
              border border-zinc-200 dark:border-zinc-700
              hover:bg-emerald-50 dark:hover:bg-emerald-900/20
              hover:text-emerald-600 dark:hover:text-emerald-400
              hover:border-transparent
              transition-all duration-150 cursor-pointer
            "
            onClick={() =>
              onFeedback({
                message_id: entry.id,
                rating: 'helpful',
              })
            }
          >
            ▲ Helpful
          </button>
          <button
            className="
              px-2 py-0.5 rounded text-[10px]
              text-zinc-400 dark:text-zinc-500
              border border-zinc-200 dark:border-zinc-700
              hover:bg-red-50 dark:hover:bg-red-900/20
              hover:text-red-600 dark:hover:text-red-400
              hover:border-transparent
              transition-all duration-150 cursor-pointer
            "
            onClick={() =>
              onFeedback({
                message_id: entry.id,
                rating: 'not_helpful',
              })
            }
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function AskAbbyChannel({ className = '' }: AskAbbyChannelProps) {
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const { response, pipelineState, isLoading, sendQuery } = useAbbyQuery();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // TODO: Replace with actual auth context
  const currentUser = { name: 'Dr. R. Nakamura', initials: 'RN' };

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, isLoading]);

  // Append Abby's response when query completes
  useEffect(() => {
    if (response) {
      setConversation((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'abby',
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

      // Add user message
      setConversation((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: query,
          timestamp: new Date().toISOString(),
          userName: currentUser.name,
        },
      ]);

      setInputValue('');
      inputRef.current?.focus();

      // Fire RAG query
      sendQuery({
        query,
        channel_id: 'ask-abby',
        channel_name: 'ask-abby',
        user_name: currentUser.name,
      });
    },
    [inputValue, isLoading, currentUser.name, sendQuery]
  );

  const handleFeedback = useCallback(async (feedback: AbbyFeedbackRequest) => {
    try {
      await submitFeedback(feedback);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Channel header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <AbbyAvatar size="lg" showStatus />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Ask Abby
          </h2>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            AI research companion · MedGemma · Institutional memory
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Online
        </div>
      </div>

      {/* Conversation area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4"
      >
        {/* Welcome card (show only when no conversation yet) */}
        {conversation.length === 0 && (
          <WelcomeCard onPromptClick={(prompt) => handleSend(prompt)} />
        )}

        {/* Messages */}
        {conversation.map((entry) =>
          entry.role === 'user' ? (
            <UserBubble
              key={entry.id}
              entry={entry}
              initials={currentUser.initials}
            />
          ) : (
            <AbbyBubble
              key={entry.id}
              entry={entry}
              onFeedback={handleFeedback}
            />
          )
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-2">
            <AbbyAvatar size="sm" />
            <div
              className="
                px-3.5 py-2.5 rounded-2xl rounded-bl-sm
                bg-zinc-100 dark:bg-zinc-800
              "
            >
              <AbbyTypingIndicator pipelineState={pipelineState} />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Abby anything about your research network..."
            disabled={isLoading}
            className="
              flex-1 h-10 px-3.5 text-[13px]
              bg-zinc-50 dark:bg-zinc-800/50
              border border-zinc-200 dark:border-zinc-700
              rounded-lg
              text-zinc-700 dark:text-zinc-300
              placeholder:text-zinc-400 dark:placeholder:text-zinc-600
              focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50
              disabled:opacity-60
              transition-all duration-150
            "
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="
              h-10 px-5 rounded-lg
              text-[13px] font-medium
              bg-emerald-600 hover:bg-emerald-700
              text-white
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150 cursor-pointer
            "
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
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
