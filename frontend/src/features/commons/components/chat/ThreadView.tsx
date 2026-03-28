import { useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Send } from "lucide-react";
import { useReplies, useSendMessage } from "../../api";
import type { Message } from "../../types";
import { ReactionPills } from "./ReactionPills";

interface ThreadViewProps {
  parentMessage: Message;
  slug: string;
  currentUserId: number;
}

export function ThreadView({ parentMessage, slug, currentUserId }: ThreadViewProps) {
  void currentUserId;
  const { data: replies = [], isLoading } = useReplies(slug, parentMessage.id);
  const sendMessage = useSendMessage();
  const [replyBody, setReplyBody] = useState("");

  function handleSendReply() {
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    sendMessage.mutate(
      { slug, body: trimmed, parentId: parentMessage.id },
      { onSuccess: () => setReplyBody("") },
    );
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  }

  return (
    <div className="mb-4 ml-[64px] mr-3 overflow-hidden rounded-2xl border border-[#2a2a31] bg-[#111115] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-1.5 border-b border-[#2a2a31] bg-[#17171c] px-4 py-2.5 text-[11px] text-muted-foreground">
        <span>Thread</span>
        <span className="opacity-50">·</span>
        <span>
          {isLoading
            ? "Loading..."
            : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        </span>
      </div>

      <div className="divide-y divide-[#23232a]">
        {!isLoading &&
          replies.map((reply) => (
            <div
              key={reply.id}
              className="px-4 py-3"
              style={{ paddingLeft: reply.depth === 2 ? 44 : 16 }}
            >
              {reply.deleted_at ? (
                <p className="text-xs italic text-muted-foreground">
                  [message deleted]
                </p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {reply.user.name}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground">
                      {new Date(reply.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {reply.is_edited && (
                      <span className="text-xs text-muted-foreground">(edited)</span>
                    )}
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                    >
                      {reply.body}
                    </ReactMarkdown>
                  </div>
                  {reply.reactions && (
                    <ReactionPills
                      messageId={reply.id}
                      reactions={reply.reactions}
                    />
                  )}
                </>
              )}
            </div>
          ))}
      </div>

      {/* Compact reply composer */}
      <div className="flex gap-2 border-t border-[#2a2a31] bg-[#15151a] px-4 py-3">
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[#2a2a31] bg-[#101014] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          onClick={handleSendReply}
          disabled={sendMessage.isPending || !replyBody.trim()}
          className="rounded-xl bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
