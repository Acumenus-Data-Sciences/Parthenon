import { useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Send } from "lucide-react";
import { useReplies, useSendMessage } from "../../api";
import type { Message } from "../../types";

interface ThreadViewProps {
  parentMessage: Message;
  slug: string;
  currentUserId: number;
}

export function ThreadView({ parentMessage, slug, currentUserId }: ThreadViewProps) {
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
    <div className="ml-12 border-l-2 border-border pl-4">
      {isLoading ? (
        <p className="py-2 text-xs text-muted-foreground">Loading replies...</p>
      ) : (
        replies.map((reply) => (
          <div
            key={reply.id}
            className="py-1.5"
            style={{ paddingLeft: reply.depth === 2 ? 24 : 0 }}
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
                  <span className="text-xs text-muted-foreground">
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
              </>
            )}
          </div>
        ))
      )}

      {/* Compact reply composer */}
      <div className="mt-2 flex gap-2">
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply..."
          rows={1}
          className="flex-1 resize-none rounded border border-border bg-muted px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          onClick={handleSendReply}
          disabled={sendMessage.isPending || !replyBody.trim()}
          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
