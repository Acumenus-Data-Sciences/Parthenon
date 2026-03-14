import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ChevronDown } from "lucide-react";
import type { Message } from "../../types";
import { useToggleReaction, usePinMessage, useCreateReviewRequest } from "../../api";
import { avatarColor } from "../../utils/avatarColor";
import { MessageActionMenu } from "./MessageActionMenu";
import { EditMessageInline } from "./EditMessageInline";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { ThreadView } from "./ThreadView";
import { ReactionPills } from "./ReactionPills";
import { ObjectReferenceCard } from "./ObjectReferenceCard";
import { AttachmentDisplay } from "./AttachmentDisplay";

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
  const pinMessage = usePinMessage();
  const createReview = useCreateReviewRequest();

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isAuthor = message.user.id === currentUserId;
  const isDeleted = message.deleted_at !== null;

  return (
    <>
      <div className="group flex gap-2.5 px-5 py-2.5 hover:bg-muted/30">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: avatarColor(message.user.id) }}
        >
          {getInitials(message.user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {message.user.name}
            </span>
            <span className="ml-1 text-[11px] text-muted-foreground">{time}</span>
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
                  onPin={() => pinMessage.mutate({ slug, messageId: message.id })}
                  onRequestReview={() => createReview.mutate({ slug, messageId: message.id })}
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
            <div className="prose prose-sm prose-invert max-w-none text-[#ccc] leading-relaxed [&_p]:my-1 [&_pre]:bg-[#1a1a22] [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_pre]:p-3 [&_code]:text-teal-400">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {message.body}
              </ReactMarkdown>
            </div>
          )}

          {/* File attachments */}
          {!isDeleted && !editing && message.attachments && message.attachments.length > 0 && (
            <AttachmentDisplay attachments={message.attachments} />
          )}

          {/* Object references */}
          {!isDeleted && !editing && message.object_references && message.object_references.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {message.object_references.map((ref) => (
                <ObjectReferenceCard key={ref.id} reference={ref} />
              ))}
            </div>
          )}

          {/* Review status badge */}
          {!isDeleted && message.review_status === "requested" && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-[11px] font-medium text-amber-400">
              Review requested
            </span>
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
