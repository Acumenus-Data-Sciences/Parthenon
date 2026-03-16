import { useState } from "react";
import { Megaphone, Pin, Bookmark, Plus, Trash2 } from "lucide-react";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useToggleBookmark,
} from "../../api";
import { avatarColor } from "../../utils/avatarColor";
import type { Announcement } from "../../types";
import { useAuthStore } from "@/stores/authStore";
import { Modal } from "@/components/ui/Modal";

/** Ensure all links in server-rendered HTML open in a new tab. */
function externalLinks(html: string): string {
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

// ---------------------------------------------------------------------------
// Category config — maps to design-system badge variants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: "general",          label: "General",          badge: "badge-info"     },
  { value: "study_recruitment",label: "Study Recruitment",badge: "badge-success"  },
  { value: "data_update",      label: "Data Update",      badge: "badge-warning"  },
  { value: "milestone",        label: "Milestone",        badge: "badge-accent"   },
  { value: "policy",           label: "Policy",           badge: "badge-critical" },
] as const;

function getCategoryBadge(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.badge ?? "badge-default";
}

function getCategoryLabel(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

// ---------------------------------------------------------------------------
// Announcement Card
// ---------------------------------------------------------------------------

interface AnnouncementCardProps {
  announcement: Announcement;
  currentUserId: number;
  onDelete: (id: number) => void;
  onBookmark: (id: number) => void;
}

function AnnouncementCard({
  announcement,
  currentUserId,
  onDelete,
  onBookmark,
}: AnnouncementCardProps) {
  const time = new Date(announcement.created_at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="panel" style={{ padding: "var(--space-4)" }}>
      {/* Top row: pin + category + actions */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {announcement.is_pinned && (
            <Pin size={13} style={{ color: "var(--warning)", flexShrink: 0 }} />
          )}
          <span className={`badge ${getCategoryBadge(announcement.category)}`}>
            {getCategoryLabel(announcement.category)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <button
            onClick={() => onBookmark(announcement.id)}
            title={announcement.is_bookmarked ? "Remove bookmark" : "Bookmark"}
            className="btn btn-ghost btn-icon btn-sm"
          >
            <Bookmark
              size={13}
              style={
                announcement.is_bookmarked
                  ? { fill: "var(--warning)", color: "var(--warning)" }
                  : {}
              }
            />
          </button>

          {announcement.user_id === currentUserId && (
            <button
              onClick={() => onDelete(announcement.id)}
              title="Delete"
              className="btn btn-ghost btn-icon btn-sm"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 style={{
        marginTop: "var(--space-2)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        color: "var(--text-primary)",
      }}>
        {announcement.title}
      </h3>

      {/* Body — rendered HTML from the backend */}
      {announcement.body_html ? (
        <div
          className="body-html"
          style={{ marginTop: "var(--space-1)", fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: externalLinks(announcement.body_html) }}
        />
      ) : (
        <p style={{
          marginTop: "var(--space-1)",
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}>
          {announcement.body}
        </p>
      )}

      {/* Footer: author + date + expiry */}
      <div style={{
        marginTop: "var(--space-3)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        flexWrap: "wrap",
      }}>
        {announcement.user && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: "50%",
                fontSize: 9,
                fontWeight: 600,
                color: "#fff",
                flexShrink: 0,
                backgroundColor: avatarColor(announcement.user.id),
              }}
            >
              {announcement.user.name[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {announcement.user.name}
            </span>
          </>
        )}
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>{time}</span>
        {announcement.expires_at && (
          <span className="badge badge-warning" style={{ fontSize: 10 }}>
            Expires {new Date(announcement.expires_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Announcement Modal
// ---------------------------------------------------------------------------

interface CreateAnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  channelSlug?: string;
}

function CreateAnnouncementModal({ open, onClose, channelSlug }: CreateAnnouncementModalProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [isPinned, setIsPinned] = useState(false);
  const createMutation = useCreateAnnouncement();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    createMutation.mutate(
      { title: title.trim(), body: body.trim(), category, channel_slug: channelSlug, is_pinned: isPinned },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setCategory("general");
          setIsPinned(false);
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Announcement"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-announcement-form"
            className="btn btn-primary"
            disabled={!title.trim() || !body.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Posting…" : "Post Announcement"}
          </button>
        </>
      }
    >
      <form id="create-announcement-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            autoFocus
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement…"
            rows={5}
            className="form-input form-textarea"
          />
        </div>

        <div style={{ display: "flex", gap: "var(--space-4)" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input form-select"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ display: "flex", alignItems: "flex-end", paddingBottom: "var(--space-4)" }}>
            <label className="form-check">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              <span>Pin to top</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Announcement Board (top-level)
// ---------------------------------------------------------------------------

interface AnnouncementBoardProps {
  channelSlug?: string;
}

export function AnnouncementBoard({ channelSlug }: AnnouncementBoardProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const { data: announcements = [], isLoading } = useAnnouncements(
    channelSlug,
    filterCategory || undefined,
  );
  const deleteMutation = useDeleteAnnouncement();
  const bookmarkMutation = useToggleBookmark();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) var(--space-4)",
        borderBottom: "1px solid var(--border-default)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Megaphone size={15} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
            Announcements
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-input form-select"
            style={{ minHeight: 30, fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-6) var(--space-1) var(--space-2)" }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
          >
            <Plus size={13} />
            New
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {isLoading && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Loading…</p>
        )}

        {!isLoading && announcements.length === 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            paddingTop: "var(--space-12)",
            paddingBottom: "var(--space-12)",
            textAlign: "center",
          }}>
            <Megaphone size={40} style={{ color: "var(--text-ghost)", opacity: 0.4 }} />
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No announcements yet</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
              Post updates, study recruitment notices, and milestones
            </p>
          </div>
        )}

        {announcements.map((a) => (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            currentUserId={currentUserId}
            onDelete={(id) => deleteMutation.mutate(id)}
            onBookmark={(id) => bookmarkMutation.mutate(id)}
          />
        ))}
      </div>

      <CreateAnnouncementModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        channelSlug={channelSlug}
      />
    </div>
  );
}
