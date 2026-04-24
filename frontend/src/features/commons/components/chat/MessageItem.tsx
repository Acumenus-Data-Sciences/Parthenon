import { useState, memo } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ChevronDown, SmilePlus, Reply, Pin } from "lucide-react";
import { formatDate } from "@/i18n/format";
import type { Message } from "../../types";
import {
  useToggleReaction,
  usePinMessage,
  useCreateReviewRequest,
} from "../../api";
import { UserAvatar } from "../UserAvatar";
import { MessageActionMenu } from "./MessageActionMenu";
import { EditMessageInline } from "./EditMessageInline";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { ThreadView } from "./ThreadView";
import { ReactionPills } from "./ReactionPills";
import { ObjectReferenceCard } from "./ObjectReferenceCard";
import { AttachmentDisplay } from "./AttachmentDisplay";

/** Convert @[id:name] mention tokens to backtick-wrapped @name for markdown rendering. */
function processMentions(body: string): string {
  return body.replace(
    /@\[(\d+):([^\]]+)\]/g,
    (_match, _id, name: string) => `\`@${name}\``,
  );
}

interface MessageItemProps {
  message: Message;
  slug: string;
  currentUserId: number;
  isAdmin?: boolean;
}

const MessageItemComponent = ({
  message,
  slug,
  currentUserId,
  isAdmin = false,
}: MessageItemProps) => {
  const { t } = useTranslation("commons");
  const [editing, setEditing] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const toggleReaction = useToggleReaction();
  const pinMessage = usePinMessage();
  const createReview = useCreateReviewRequest();

  const time = formatDate(message.created_at, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isAuthor = message.user.id === currentUserId;
  const isDeleted = message.deleted_at !== null;

  return (
    <>
      <div className="group relative mb-2 rounded-2xl border border-transparent px-3 py-3 transition-colors duration-150 hover:border-white/[0.05] hover:bg-white/[0.02]">
        <div className="flex gap-3">
          {/* Floating action bar — appears on hover */}
          {!isDeleted && (
            <div className="absolute right-4 top-0 z-10 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-surface-overlay px-1 py-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <ActionBarButton
                  icon={SmilePlus}
                  label={t("chat.actions.react")}
                  onClick={() => {}}
                />
                <ActionBarButton
                  icon={Reply}
                  label={t("chat.actions.reply")}
                  onClick={() => setShowThread(true)}
                />
                <ActionBarButton
                  icon={Pin}
                  label={t("chat.actions.pin")}
                  onClick={() =>
                    pinMessage.mutate({ slug, messageId: message.id })
                  }
                />
                <MessageActionMenu
                  isAuthor={isAuthor}
                  isAdmin={isAdmin}
                  onReply={() => setShowThread(true)}
                  onEdit={() => setEditing(true)}
                  onDelete={() => setShowDeleteConfirm(true)}
                  onReact={(emoji) =>
                    toggleReaction.mutate({ messageId: message.id, emoji })
                  }
                  onPin={() =>
                    pinMessage.mutate({ slug, messageId: message.id })
                  }
                  onRequestReview={() =>
                    createReview.mutate({ slug, messageId: message.id })
                  }
                />
              </div>
            </div>
          )}
          <UserAvatar user={message.user} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold tracking-tight text-foreground">
                {message.user.name}
              </span>
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-muted-foreground">
                {time}
              </span>
              {message.is_edited && !isDeleted && (
                <span className="text-xs text-muted-foreground">
                  {t("chat.messages.edited")}
                </span>
              )}
            </div>

            {isDeleted ? (
              <p className="text-sm italic text-muted-foreground">
                {t("chat.messages.deleted")}
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
              <div className="prose prose-sm prose-invert mt-1 max-w-none text-text-secondary leading-7 [&_p]:my-1.5 [&_pre]:bg-surface-base [&_pre]:border [&_pre]:border-white/[0.06] [&_pre]:rounded-xl [&_pre]:p-3 [&_code]:text-teal-400 [&_code.mention]:rounded [&_code.mention]:border-0 [&_code.mention]:bg-teal-500/10 [&_code.mention]:text-teal-300 [&_code.mention]:px-1 [&_code.mention]:py-0.5">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={{
                    code: ({ children, className, ...rest }) => (
                      <code
                        className={
                          typeof children === "string" &&
                          children.startsWith("@")
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
            {!isDeleted &&
              !editing &&
              message.attachments &&
              message.attachments.length > 0 && (
                <AttachmentDisplay attachments={message.attachments} />
              )}

            {/* Object references */}
            {!isDeleted &&
              !editing &&
              message.object_references &&
              message.object_references.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {message.object_references.map((ref) => (
                    <ObjectReferenceCard key={ref.id} reference={ref} />
                  ))}
                </div>
              )}

            {/* Review status badge */}
            {!isDeleted && message.review_status === "requested" && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-[11px] font-medium text-amber-400">
                {t("chat.messages.reviewRequested")}
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
                className="group/thread mt-3 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs text-primary transition-all duration-150 hover:border-white/[0.08] hover:bg-white/[0.04]"
              >
                <div className="flex -space-x-1.5">
                  <div className="h-5 w-5 rounded-full bg-primary/20 border border-surface-base flex items-center justify-center text-[7px] font-semibold text-primary">
                    {message.reply_count}
                  </div>
                </div>
                <span>
                  {t("chat.messages.replyCount", {
                    count: message.reply_count,
                  })}
                </span>
                <span className="text-muted-foreground/50 group-hover/thread:text-muted-foreground transition-colors">
                  {t("chat.messages.viewThread")}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
              </button>
            )}
          </div>
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
};

export const MessageItem = memo(MessageItemComponent);

function ActionBarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-white/[0.08] hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
