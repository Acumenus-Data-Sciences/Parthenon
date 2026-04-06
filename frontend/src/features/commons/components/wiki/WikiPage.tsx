import { useEffect } from "react";
import { AlertTriangle, Bot, BookOpen, History, Sparkles, Upload } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import {
  useInitWikiWorkspace,
  useIngestWikiSource,
  useWikiActivity,
  useWikiLint,
  useWikiPage,
  useWikiPages,
  useWikiQuery,
  useWikiWorkspaces,
} from "../../api/wiki";
import { useWikiStore } from "@/stores/wikiStore";
import { WikiActivityFeed } from "./WikiActivityFeed";
import { WikiIngestPanel } from "./WikiIngestPanel";
import { WikiPageTree } from "./WikiPageTree";
import { WikiPageView } from "./WikiPageView";
import { WikiQueryPanel } from "./WikiQueryPanel";

type SidebarTab = "ingest" | "ask" | "activity";

const SIDEBAR_TABS: { key: SidebarTab; label: string; icon: typeof Upload }[] = [
  { key: "ingest", label: "Ingest", icon: Upload },
  { key: "ask", label: "Ask", icon: Bot },
  { key: "activity", label: "Activity", icon: History },
];

export function WikiPage() {
  const workspace = useWikiStore((state) => state.workspace);
  const selectedPageSlug = useWikiStore((state) => state.selectedPageSlug);
  const searchQuery = useWikiStore((state) => state.searchQuery);
  const lastQueryResponse = useWikiStore((state) => state.lastQueryResponse);
  const lastLintResponse = useWikiStore((state) => state.lastLintResponse);
  const draftWorkspaceName = useWikiStore((state) => state.draftWorkspaceName);
  const sidebarTab = useWikiStore((state) => state.sidebarTab);
  const setWorkspace = useWikiStore((state) => state.setWorkspace);
  const setSelectedPageSlug = useWikiStore((state) => state.setSelectedPageSlug);
  const setSearchQuery = useWikiStore((state) => state.setSearchQuery);
  const setLastQueryResponse = useWikiStore((state) => state.setLastQueryResponse);
  const setLastLintResponse = useWikiStore((state) => state.setLastLintResponse);
  const setDraftWorkspaceName = useWikiStore((state) => state.setDraftWorkspaceName);
  const setSidebarTab = useWikiStore((state) => state.setSidebarTab);

  const workspacesQuery = useWikiWorkspaces();
  const pagesQuery = useWikiPages(workspace, searchQuery);
  const pageQuery = useWikiPage(workspace, selectedPageSlug);
  const activityQuery = useWikiActivity(workspace);
  const initWorkspace = useInitWikiWorkspace();
  const ingestMutation = useIngestWikiSource();
  const queryMutation = useWikiQuery();
  const lintMutation = useWikiLint();

  const workspaces = workspacesQuery.data ?? [];
  const pages = pagesQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const lintIssues = lastLintResponse?.issues ?? [];

  // Auto-select workspace
  useEffect(() => {
    if (!workspaces.length) return;
    if (!workspaces.some((ws) => ws.name === workspace)) {
      setWorkspace(workspaces[0].name);
    }
  }, [workspaces, workspace, setWorkspace]);

  // Auto-select first page
  useEffect(() => {
    if (!pages.length) {
      if (selectedPageSlug) setSelectedPageSlug(null);
      return;
    }
    if (!selectedPageSlug || !pages.some((page) => page.slug === selectedPageSlug)) {
      setSelectedPageSlug(pages[0].slug);
    }
  }, [pages, selectedPageSlug, setSelectedPageSlug]);

  // Auto-lint on workspace load
  useEffect(() => {
    if (pages.length > 0 && !lastLintResponse) {
      lintMutation.mutate(
        { workspace },
        { onSuccess: (response) => setLastLintResponse(response) },
      );
    }
    // Only run when pages first load for a workspace
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, pages.length > 0]);

  function handleCreateWorkspace() {
    const name = draftWorkspaceName.trim();
    if (!name) return;
    initWorkspace.mutate(name, {
      onSuccess: (created) => {
        setWorkspace(created.name);
        setDraftWorkspaceName("");
        toast.success(`Workspace "${created.name}" initialized`);
      },
      onError: () => toast.error("Unable to initialize workspace"),
    });
  }

  function handleIngest(payload: { title?: string; rawContent?: string; file?: File | null }) {
    ingestMutation.mutate(
      { workspace, title: payload.title, rawContent: payload.rawContent, file: payload.file ?? null },
      {
        onSuccess: (response) => {
          const preferred = response.created_pages.find((p) => p.page_type !== "source_summary")
            ?? response.created_pages[0];
          setSelectedPageSlug(preferred?.slug ?? null);
          setLastLintResponse(null); // stale — re-lint will trigger
          toast.success(`Ingested "${response.source_title}"`);
        },
        onError: () => toast.error("Ingest failed"),
      },
    );
  }

  function handleQuery(question: string) {
    queryMutation.mutate(
      { workspace, question },
      {
        onSuccess: (response) => setLastQueryResponse(response),
        onError: () => toast.error("Query failed"),
      },
    );
  }

  function handleNavigate(slug: string) {
    setSelectedPageSlug(slug);
  }

  const isEmpty = pages.length === 0 && !pagesQuery.isLoading;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_32%),#121216]">
      {/* Header — compact */}
      <div className="border-b border-white/[0.06] bg-[#15151a]/80 px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Commons Wiki</h1>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] text-primary">
              <Sparkles className="h-3 w-3" />
              AI-maintained
            </div>
          </div>

          {lintIssues.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const firstIssue = lintIssues[0];
                if (firstIssue) setSelectedPageSlug(firstIssue.page_slug);
              }}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[11px] text-amber-400 transition hover:bg-amber-500/10"
            >
              <AlertTriangle className="h-3 w-3" />
              {lintIssues.length} issue{lintIssues.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      {isEmpty ? (
        <EmptyState
          workspace={workspace}
          loading={ingestMutation.isPending}
          onIngest={handleIngest}
          workspaces={workspaces}
          onWorkspaceChange={setWorkspace}
          draftWorkspaceName={draftWorkspaceName}
          onDraftChange={setDraftWorkspaceName}
          onCreateWorkspace={handleCreateWorkspace}
          creatingWorkspace={initWorkspace.isPending}
        />
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[260px,minmax(0,1fr),340px]">
          {/* Left: Page tree with workspace */}
          <WikiPageTree
            pages={pages}
            selectedSlug={selectedPageSlug}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelect={setSelectedPageSlug}
            workspaces={workspaces}
            workspace={workspace}
            onWorkspaceChange={setWorkspace}
            draftWorkspaceName={draftWorkspaceName}
            onDraftChange={setDraftWorkspaceName}
            onCreateWorkspace={handleCreateWorkspace}
            creatingWorkspace={initWorkspace.isPending}
            lintIssues={lintIssues}
          />

          {/* Center: Page content */}
          <WikiPageView
            page={pageQuery.data}
            onNavigate={handleNavigate}
            lintIssues={lintIssues}
          />

          {/* Right: Tabbed sidebar */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#15151a]">
            <div className="flex border-b border-white/[0.06]">
              {SIDEBAR_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSidebarTab(tab.key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition ${
                      sidebarTab === tab.key
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.key === "activity" && activity.length > 0 && (
                      <span className="ml-0.5 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px]">
                        {activity.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {sidebarTab === "ingest" && (
                <WikiIngestPanel
                  workspace={workspace}
                  loading={ingestMutation.isPending}
                  onSubmit={handleIngest}
                />
              )}
              {sidebarTab === "ask" && (
                <WikiQueryPanel
                  loading={queryMutation.isPending}
                  onSubmit={handleQuery}
                  onNavigate={handleNavigate}
                  response={lastQueryResponse}
                />
              )}
              {sidebarTab === "activity" && (
                <div className="h-full overflow-y-auto">
                  <WikiActivityFeed activity={activity} onNavigate={handleNavigate} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Empty / onboarding state ─────────────────────────────────────── */

function EmptyState({
  workspace,
  loading,
  onIngest,
  workspaces,
  onWorkspaceChange,
  draftWorkspaceName,
  onDraftChange,
  onCreateWorkspace,
  creatingWorkspace,
}: {
  workspace: string;
  loading: boolean;
  onIngest: (payload: { title?: string; rawContent?: string; file?: File | null }) => void;
  workspaces: { name: string; page_count: number }[];
  onWorkspaceChange: (ws: string) => void;
  draftWorkspaceName: string;
  onDraftChange: (v: string) => void;
  onCreateWorkspace: () => void;
  creatingWorkspace: boolean;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
            Your wiki is empty
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Paste text, upload a document, or drop a file to populate <span className="font-medium text-foreground">{workspace}</span>.
            The AI will extract structure, create pages, and link concepts automatically.
          </p>
        </div>

        {/* Inline ingest form */}
        <div className="mt-8">
          <WikiIngestPanel workspace={workspace} loading={loading} onSubmit={onIngest} />
        </div>

        {/* Workspace switcher — secondary */}
        {workspaces.length > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Switch workspace:</span>
            {workspaces.map((ws) => (
              <button
                key={ws.name}
                type="button"
                onClick={() => onWorkspaceChange(ws.name)}
                className={`rounded-full px-2.5 py-1 transition ${
                  ws.name === workspace
                    ? "bg-primary/10 text-primary"
                    : "border border-white/[0.08] hover:text-foreground"
                }`}
              >
                {ws.name} ({ws.page_count})
              </button>
            ))}
          </div>
        )}

        {/* Create workspace */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <input
            value={draftWorkspaceName}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="new workspace name"
            className="rounded-lg border border-white/[0.08] bg-[#111115] px-3 py-1.5 text-xs text-foreground outline-none transition focus:border-primary/50"
          />
          <button
            type="button"
            onClick={onCreateWorkspace}
            disabled={creatingWorkspace || !draftWorkspaceName.trim()}
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
          >
            {creatingWorkspace ? "Creating..." : "Create workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}
