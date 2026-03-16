import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ChevronDown, SmilePlus, Reply, Pin } from "lucide-react";
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

/** Convert @[id:name] mention tokens to backtick-wrapped @name for markdown rendering. */
function processMentions(body: string): string {
  return body.replace(/@\[(\d+):([^\]]+)\]/g, (_match, _id, name: string) => `\`@${name}\``);
}

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
      <div className="group relative flex gap-2.5 px-5 py-3 hover:bg-white/[0.02] transition-colors duration-150">
          {/* Floating action bar — appears on hover */}
          {!isDeleted && (
            <div className="absolute -top-3.5 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
              <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-[#1a1a24] px-1 py-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <ActionBarButton icon={SmilePlus} label="React" onClick={() => {}} />
                <ActionBarButton icon={Reply} label="Reply" onClick={() => setShowThread(true)} />
                <ActionBarButton icon={Pin} label="Pin" onClick={() => pinMessage.mutate({ slug, messageId: message.id })} />
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
            </div>
          )}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: avatarColor(message.user.id) }}
        >
          {getInitials(message.user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              {message.user.name}
            </span>
            <span className="ml-1 text-[11px] text-muted-foreground">{time}</span>
            {message.is_edited && !isDeleted && (
              <span className="text-xs text-muted-foreground">(edited)</span>
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
            <div className="prose prose-sm prose-invert max-w-none text-[#b8b8c0] leading-relaxed [&_p]:my-1 [&_pre]:bg-[#13131a] [&_pre]:border [&_pre]:border-white/[0.06] [&_pre]:rounded-md [&_pre]:p-3 [&_code]:text-teal-400 [&_code.mention]:rounded [&_code.mention]:border-0 [&_code.mention]:bg-teal-500/10 [&_code.mention]:text-teal-300 [&_code.mention]:px-1 [&_code.mention]:py-0.5">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  code: ({ children, className, ...rest }) => (
                    <code
                      className={
                        typeof children === "string" && children.startsWith("@")
                          ? `mention ${className ?? ""}`
                          : className
                      }
                      {...rest}
                    >
                      {children}
                    </code>
                  ),
                }}
              >
                {processMentions(message.body)}
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

          {/* Thread preview — stacked avatars + reply count */}
          {(message.reply_count ?? 0) > 0 && !showThread && (
            <button
              onClick={() => setShowThread(true)}
              className="mt-2 flex items-center gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5 text-xs text-primary hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-150 group/thread"
            >
              <div className="flex -space-x-1.5">
                <div className="h-5 w-5 rounded-full bg-primary/20 border border-[#0e0e11] flex items-center justify-center text-[7px] font-semibold text-primary">
                  {message.reply_count}
                </div>
              </div>
              <span>
                {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
              </span>
              <span className="text-muted-foreground/50 group-hover/thread:text-muted-foreground transition-colors">
                View thread
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
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

function ActionBarButton({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-white/[0.08] hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
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
