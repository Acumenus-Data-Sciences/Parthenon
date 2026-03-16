import { useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  ArrowLeft,
  Edit2,
  Trash2,
  Clock,
  Tag,
} from "lucide-react";
import {
  useWikiArticles,
  useWikiArticle,
  useCreateWikiArticle,
  useUpdateWikiArticle,
  useDeleteWikiArticle,
  useWikiRevisions,
} from "../../api";
import { avatarColor } from "../../utils/avatarColor";
import type { WikiArticle } from "../../types";
import { useAuthStore } from "@/stores/authStore";
import { Modal } from "@/components/ui/Modal";

// ---------------------------------------------------------------------------
// Article List
// ---------------------------------------------------------------------------

function ArticleList({
  onSelect,
  onCreate,
}: {
  onSelect: (slug: string) => void;
  onCreate: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: articles = [], isLoading } = useWikiArticles(
    searchQuery.length >= 2 ? searchQuery : undefined,
  );

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
          <BookOpen size={15} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
            Knowledge Base
          </span>
        </div>
        <button
          onClick={onCreate}
          className="btn btn-primary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
        >
          <Plus size={13} />
          New Article
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: "var(--space-3)",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-ghost)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles…"
            className="form-input"
            style={{ paddingLeft: "var(--space-8)", fontSize: "var(--text-xs)", minHeight: 32 }}
          />
        </div>
      </div>

      {/* Article list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading && (
          <p style={{ padding: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Loading…</p>
        )}

        {!isLoading && articles.length === 0 && (
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
            <BookOpen size={40} style={{ color: "var(--text-ghost)", opacity: 0.4 }} />
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No articles yet</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
              Document institutional knowledge, tips, and lessons learned
            </p>
          </div>
        )}

        {articles.map((article) => (
          <button
            key={article.id}
            onClick={() => onSelect(article.slug)}
            style={{
              display: "block",
              width: "100%",
              padding: "var(--space-3) var(--space-4)",
              textAlign: "left",
              borderBottom: "1px solid var(--border-subtle)",
              background: "none",
              cursor: "pointer",
              transition: "background var(--duration-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-overlay)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <p style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)", marginBottom: "var(--space-1)" }}>
              {article.title}
            </p>
            <p style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {article.body.slice(0, 150)}
            </p>
            <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {article.author && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
                  {article.author.name}
                </span>
              )}
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
                {new Date(article.updated_at).toLocaleDateString()}
              </span>
              {article.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="badge badge-info" style={{ fontSize: 10 }}>
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Article Detail
// ---------------------------------------------------------------------------

function ArticleDetail({
  slug,
  onBack,
  onEdit,
}: {
  slug: string;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { data: article, isLoading } = useWikiArticle(slug);
  const { data: revisions = [] } = useWikiRevisions(slug);
  const deleteMutation = useDeleteWikiArticle();
  const user = useAuthStore((s) => s.user);
  const [showRevisions, setShowRevisions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading || !article) {
    return <p style={{ padding: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Loading…</p>;
  }

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
        <button
          onClick={onBack}
          className="btn btn-ghost btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
        >
          <ArrowLeft size={13} />
          Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          {revisions.length > 0 && (
            <button
              onClick={() => setShowRevisions(!showRevisions)}
              title="Edit history"
              className="btn btn-ghost btn-icon btn-sm"
            >
              <Clock size={13} />
            </button>
          )}
          <button onClick={onEdit} title="Edit" className="btn btn-ghost btn-icon btn-sm">
            <Edit2 size={13} />
          </button>
          {article.created_by === user?.id && (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              className="btn btn-ghost btn-icon btn-sm"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)" }}>
          {article.title}
        </h1>

        {/* Author + date */}
        <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {article.author && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: avatarColor(article.author.id),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {article.author.name[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {article.author.name}
              </span>
            </div>
          )}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
            Updated {new Date(article.updated_at).toLocaleDateString()}
          </span>
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div style={{ marginTop: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
            {article.tags.map((tag) => (
              <span key={tag} className="badge badge-info" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                <Tag size={10} />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{
          marginTop: "var(--space-5)",
          fontSize: "var(--text-sm)",
          lineHeight: 1.75,
          color: "var(--text-secondary)",
          whiteSpace: "pre-wrap",
        }}>
          {article.body}
        </div>

        {/* Revision history */}
        {showRevisions && revisions.length > 0 && (
          <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-default)" }}>
            <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
              Edit History ({revisions.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {revisions.map((rev) => (
                <div key={rev.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  <Clock size={11} />
                  <span>{rev.editor?.name ?? "Unknown"}</span>
                  <span style={{ color: "var(--text-ghost)" }}>
                    {new Date(rev.created_at).toLocaleString()}
                  </span>
                  {rev.edit_summary && (
                    <span style={{ fontStyle: "italic", color: "var(--text-ghost)" }}>
                      — {rev.edit_summary}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Article"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(slug, { onSuccess: onBack })}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          This article and all its revision history will be permanently deleted. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Article Editor (create / edit) — uses Modal
// ---------------------------------------------------------------------------

interface ArticleEditorProps {
  article?: WikiArticle;
  open: boolean;
  onClose: () => void;
}

function ArticleEditor({ article, open, onClose }: ArticleEditorProps) {
  const [title, setTitle] = useState(article?.title ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [tagsInput, setTagsInput] = useState(article?.tags.join(", ") ?? "");
  const [editSummary, setEditSummary] = useState("");
  const createMutation = useCreateWikiArticle();
  const updateMutation = useUpdateWikiArticle();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (article) {
      updateMutation.mutate(
        { slug: article.slug, title: title.trim(), body: body.trim(), tags, edit_summary: editSummary.trim() || undefined },
        { onSuccess: () => onClose() },
      );
    } else {
      createMutation.mutate(
        { title: title.trim(), body: body.trim(), tags },
        { onSuccess: () => onClose() },
      );
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={article ? "Edit Article" : "New Article"}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="wiki-article-form"
            className="btn btn-primary"
            disabled={!title.trim() || !body.trim() || isPending}
          >
            {isPending ? "Saving…" : article ? "Save Changes" : "Publish"}
          </button>
        </>
      }
    >
      <form id="wiki-article-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title"
            autoFocus
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Content</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your article content…"
            rows={12}
            className="form-input form-textarea"
            style={{ minHeight: 220 }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Tags <span style={{ color: "var(--text-ghost)" }}>(comma-separated)</span>
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. omop, cohort, data-quality"
            className="form-input"
          />
        </div>

        {article && (
          <div className="form-group">
            <label className="form-label">
              Edit Summary <span style={{ color: "var(--text-ghost)" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="Briefly describe what changed"
              className="form-input"
            />
          </div>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// WikiPage (top-level)
// ---------------------------------------------------------------------------

type WikiView =
  | { mode: "list" }
  | { mode: "detail"; slug: string }
  | { mode: "create" }
  | { mode: "edit"; slug: string };

export function WikiPage() {
  const [view, setView] = useState<WikiView>({ mode: "list" });
  const { data: editArticle } = useWikiArticle(
    view.mode === "edit" ? view.slug : "",
  );

  return (
    <>
      {/* List is always mounted — detail replaces it visually */}
      {(view.mode === "list" || view.mode === "create") && (
        <ArticleList
          onSelect={(slug) => setView({ mode: "detail", slug })}
          onCreate={() => setView({ mode: "create" })}
        />
      )}

      {view.mode === "detail" && (
        <ArticleDetail
          slug={view.slug}
          onBack={() => setView({ mode: "list" })}
          onEdit={() => setView({ mode: "edit", slug: view.slug })}
        />
      )}

      {/* Editors render as modals over the current view */}
      <ArticleEditor
        open={view.mode === "create"}
        onClose={() => setView({ mode: "list" })}
      />

      {view.mode === "edit" && editArticle && (
        <ArticleEditor
          article={editArticle}
          open
          onClose={() => setView({ mode: "detail", slug: view.slug })}
        />
      )}
    </>
  );
}
