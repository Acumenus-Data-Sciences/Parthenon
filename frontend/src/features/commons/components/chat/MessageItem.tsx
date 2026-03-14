import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ChevronDown } from "lucide-react";
import type { Message } from "../../types";
import { useToggleReaction } from "../../api";
import { MessageActionMenu } from "./MessageActionMenu";
import { EditMessageInline } from "./EditMessageInline";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { ThreadView } from "./ThreadView";
import { ReactionPills } from "./ReactionPills";

interface MessageItemProps {
  message: Message;
  slug: string;
  currentUserId: number;
  isAdmin?: boolean;
}

export function MessageItem({
  message,
  slug,
  currentUserId,
  isAdmin = false,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const toggleReaction = useToggleReaction();

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isAuthor = message.user.id === currentUserId;
  const isDeleted = message.deleted_at !== null;

  return (
    <>
      <div className="group flex gap-3 px-5 py-2 hover:bg-muted/30">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {getInitials(message.user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {message.user.name}
            </span>
            <span className="text-xs text-muted-foreground">{time}</span>
            {message.is_edited && !isDeleted && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
            {/* Action menu — visible on hover */}
            {!isDeleted && (
              <div className="ml-auto opacity-0 group-hover:opacity-100">
                <MessageActionMenu
                  isAuthor={isAuthor}
                  isAdmin={isAdmin}
                  onReply={() => setShowThread(true)}
                  onEdit={() => setEditing(true)}
                  onDelete={() => setShowDeleteConfirm(true)}
                  onReact={(emoji) => toggleReaction.mutate({ messageId: message.id, emoji })}
                />
              </div>
            )}
          </div>

          {isDeleted ? (
            <p className="text-sm italic text-muted-foreground">
              [message deleted]
            </p>
          ) : editing ? (
            <EditMessageInline
              messageId={message.id}
              originalBody={message.body}
              slug={slug}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <div className="prose prose-sm prose-invert max-w-none text-foreground [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_code]:text-teal-400">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {message.body}
              </ReactMarkdown>
            </div>
          )}

            {/* Reaction pills */}
            {!isDeleted && !editing && message.reactions && (
              <ReactionPills
                messageId={message.id}
                reactions={message.reactions}
              />
            )}

          {/* Reply count link */}
          {(message.reply_count ?? 0) > 0 && !showThread && (
            <button
              onClick={() => setShowThread(true)}
              className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ChevronDown className="h-3 w-3" />
              {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>

      {/* Inline thread */}
      {showThread && (
        <ThreadView
          parentMessage={message}
          slug={slug}
          currentUserId={currentUserId}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <DeleteConfirmation
          messageId={message.id}
          onCancel={() => setShowDeleteConfirm(false)}
          onDeleted={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
