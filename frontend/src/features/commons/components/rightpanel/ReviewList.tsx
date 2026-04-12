import { useState } from "react";
import { Check, X, Clock, ClipboardCheck } from "lucide-react";
import { useReviews, useResolveReview } from "../../api";
import { UserAvatar } from "../UserAvatar";

interface ReviewListProps {
  slug: string;
}

export function ReviewList({ slug }: ReviewListProps) {
  const { data: reviews = [], isLoading } = useReviews(slug);

  const pending = reviews.filter((r) => r.status === "pending");
  const resolved = reviews.filter((r) => r.status !== "pending");

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>;
  }

  if (reviews.length === 0) {
    return (
      <div className="m-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-default bg-surface-base p-6 text-center">
        <ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No review requests yet</p>
        <p className="text-xs text-muted-foreground/60">
          Use the message menu to request a review
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {pending.length > 0 && (
        <>
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pending ({pending.length})
          </p>
          {pending.map((review) => (
            <ReviewItem key={review.id} review={review} slug={slug} />
          ))}
        </>
      )}
      {resolved.length > 0 && (
        <>
          <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Resolved ({resolved.length})
          </p>
          {resolved.map((review) => (
            <ReviewItem key={review.id} review={review} slug={slug} />
          ))}
        </>
      )}
    </div>
  );
}

function ReviewItem({
  review,
  slug,
}: {
  review: {
    id: number;
    status: "pending" | "approved" | "changes_requested";
    comment: string | null;
    created_at: string;
    resolved_at: string | null;
    message?: { id: number; body: string; user: { id: number; name: string }; created_at: string };
    requester?: { id: number; name: string };
    reviewer?: { id: number; name: string } | null;
  };
  slug: string;
}) {
  const resolve = useResolveReview();
  const [comment, setComment] = useState("");
  const [showResolve, setShowResolve] = useState(false);

  const statusConfig = {
    pending: { icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10", label: "Pending" },
    approved: { icon: Check, color: "text-green-400", bg: "bg-green-400/10", label: "Approved" },
    changes_requested: { icon: X, color: "text-red-400", bg: "bg-red-400/10", label: "Changes Requested" },
  };

  const cfg = statusConfig[review.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="rounded-xl border border-border-default bg-surface-base px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 rounded-full p-1 ${cfg.bg}`}>
          <StatusIcon className={`h-3 w-3 ${cfg.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
            <span className="text-[10px] text-muted-foreground">
              by {review.requester?.name ?? "Unknown"}
            </span>
          </div>

          {review.message && (
            <p className="mt-1 text-xs text-foreground/80 line-clamp-2">
              {review.message.body}
            </p>
          )}

          {review.message?.user && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <UserAvatar user={review.message.user} size="sm" />
              <span className="text-[10px] text-muted-foreground">
                {review.message.user.name}
              </span>
            </div>
          )}

          {review.comment && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              &ldquo;{review.comment}&rdquo;
              {review.reviewer && (
                <span className="ml-1 not-italic">— {review.reviewer.name}</span>
              )}
            </p>
          )}

          {review.status === "pending" && (
            <>
              {!showResolve ? (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => resolve.mutate({ id: review.id, slug, status: "approved" })}
                    className="rounded bg-green-600/20 px-2 py-0.5 text-[10px] font-medium text-green-400 hover:bg-green-600/30"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setShowResolve(true)}
                    className="rounded bg-red-600/20 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-600/30"
                  >
                    Request Changes
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-1.5">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What needs to change?"
                    className="w-full rounded-xl border border-border-default bg-surface-raised px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        resolve.mutate({ id: review.id, slug, status: "changes_requested", comment });
                        setShowResolve(false);
                        setComment("");
                      }}
                      className="rounded bg-red-600/20 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-600/30"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => { setShowResolve(false); setComment(""); }}
                      className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
