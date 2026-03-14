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
  X,
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Knowledge Base</h2>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3 w-3" />
          New Article
        </button>
      </div>

      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full rounded border border-border bg-[#1a1a22] py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="px-4 text-sm text-muted-foreground">Loading...</p>
        )}

        {!isLoading && articles.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No articles yet</p>
            <p className="text-xs text-muted-foreground/60">
              Document institutional knowledge, tips, and lessons learned
            </p>
          </div>
        )}

        {articles.map((article) => (
          <button
            key={article.id}
            onClick={() => onSelect(article.slug)}
            className="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/30"
          >
            <h3 className="text-sm font-medium text-foreground">{article.title}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {article.body.slice(0, 150)}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              {article.author && (
                <span className="text-[11px] text-muted-foreground/60">
                  {article.author.name}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground/40">
                {new Date(article.updated_at).toLocaleDateString()}
              </span>
              {article.tags.length > 0 && (
                <div className="flex gap-1">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
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

  if (isLoading || !article) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRevisions(!showRevisions)}
            title="History"
            className="rounded p-1.5 text-muted-foreground hover:text-foreground"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="rounded p-1.5 text-muted-foreground hover:text-foreground"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {article.created_by === user?.id && (
            <button
              onClick={() => {
                deleteMutation.mutate(slug, { onSuccess: onBack });
              }}
              title="Delete"
              className="rounded p-1.5 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h1 className="text-lg font-bold text-foreground">{article.title}</h1>

        <div className="mt-2 flex items-center gap-2">
          {article.author && (
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                style={{ backgroundColor: avatarColor(article.author.id) }}
              >
                {article.author.name[0]?.toUpperCase()}
              </div>
              <span className="text-xs text-muted-foreground">{article.author.name}</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground/60">
            Updated {new Date(article.updated_at).toLocaleDateString()}
          </span>
        </div>

        {article.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {article.body}
        </div>

        {showRevisions && revisions.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
              Edit History ({revisions.length})
            </h3>
            <div className="space-y-2">
              {revisions.map((rev) => (
                <div key={rev.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{rev.editor?.name ?? "Unknown"}</span>
                  <span className="text-muted-foreground/40">
                    {new Date(rev.created_at).toLocaleString()}
                  </span>
                  {rev.edit_summary && (
                    <span className="italic text-muted-foreground/60">
                      — {rev.edit_summary}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Article Editor
// ---------------------------------------------------------------------------

function ArticleEditor({
  article,
  onClose,
}: {
  article?: WikiArticle;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(article?.title ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [tagsInput, setTagsInput] = useState(article?.tags.join(", ") ?? "");
  const [editSummary, setEditSummary] = useState("");
  const createMutation = useCreateWikiArticle();
  const updateMutation = useUpdateWikiArticle();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (article) {
      updateMutation.mutate(
        {
          slug: article.slug,
          title: title.trim(),
          body: body.trim(),
          tags,
          edit_summary: editSummary.trim() || undefined,
        },
        { onSuccess: () => onClose() },
      );
    } else {
      createMutation.mutate(
        { title: title.trim(), body: body.trim(), tags },
        { onSuccess: () => onClose() },
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {article ? "Edit Article" : "New Article"}
        </h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title"
          className="mb-3 w-full rounded border border-border bg-[#1a1a22] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your article content..."
          className="mb-3 min-h-[200px] flex-1 resize-none rounded border border-border bg-[#1a1a22] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Tags (comma-separated)"
          className="mb-3 w-full rounded border border-border bg-[#1a1a22] px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        {article && (
          <input
            type="text"
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            placeholder="Edit summary (optional)"
            className="mb-3 w-full rounded border border-border bg-[#1a1a22] px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !body.trim() || isPending}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Saving..." : article ? "Save Changes" : "Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wiki Page (top-level)
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

  switch (view.mode) {
    case "list":
      return (
        <ArticleList
          onSelect={(slug) => setView({ mode: "detail", slug })}
          onCreate={() => setView({ mode: "create" })}
        />
      );
    case "detail":
      return (
        <ArticleDetail
          slug={view.slug}
          onBack={() => setView({ mode: "list" })}
          onEdit={() => setView({ mode: "edit", slug: view.slug })}
        />
      );
    case "create":
      return <ArticleEditor onClose={() => setView({ mode: "list" })} />;
    case "edit":
      return editArticle ? (
        <ArticleEditor
          article={editArticle}
          onClose={() => setView({ mode: "detail", slug: view.slug })}
        />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">Loading...</p>
      );
  }
}
