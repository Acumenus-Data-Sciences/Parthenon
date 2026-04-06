import { useEffect, useState } from "react";
import { BookOpen, PencilRuler, Sparkles } from "lucide-react";
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
import { WikiWorkspaceSelector } from "./WikiWorkspaceSelector";
import { LegacyWikiPage } from "./LegacyWikiPage";

function AiWikiPage() {
  const workspace = useWikiStore((state) => state.workspace);
  const selectedPageSlug = useWikiStore((state) => state.selectedPageSlug);
  const searchQuery = useWikiStore((state) => state.searchQuery);
  const queryPanelOpen = useWikiStore((state) => state.queryPanelOpen);
  const ingestPanelOpen = useWikiStore((state) => state.ingestPanelOpen);
  const lastQueryResponse = useWikiStore((state) => state.lastQueryResponse);
  const lastLintResponse = useWikiStore((state) => state.lastLintResponse);
  const draftWorkspaceName = useWikiStore((state) => state.draftWorkspaceName);
  const setWorkspace = useWikiStore((state) => state.setWorkspace);
  const setSelectedPageSlug = useWikiStore((state) => state.setSelectedPageSlug);
  const setSearchQuery = useWikiStore((state) => state.setSearchQuery);
  const setQueryPanelOpen = useWikiStore((state) => state.setQueryPanelOpen);
  const setIngestPanelOpen = useWikiStore((state) => state.setIngestPanelOpen);
  const setLastQueryResponse = useWikiStore((state) => state.setLastQueryResponse);
  const setLastLintResponse = useWikiStore((state) => state.setLastLintResponse);
  const setDraftWorkspaceName = useWikiStore((state) => state.setDraftWorkspaceName);

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

  useEffect(() => {
    if (!workspaces.length) return;
    if (!workspaces.some((candidate) => candidate.name === workspace)) {
      setWorkspace(workspaces[0].name);
    }
  }, [workspaces, workspace, setWorkspace]);

  useEffect(() => {
    if (!pages.length) {
      if (selectedPageSlug) setSelectedPageSlug(null);
      return;
    }

    if (!selectedPageSlug || !pages.some((page) => page.slug === selectedPageSlug)) {
      setSelectedPageSlug(pages[0].slug);
    }
  }, [pages, selectedPageSlug, setSelectedPageSlug]);

  function handleCreateWorkspace() {
    const nextWorkspace = draftWorkspaceName.trim();
    if (!nextWorkspace) return;
    initWorkspace.mutate(nextWorkspace, {
      onSuccess: (created) => {
        setWorkspace(created.name);
        setDraftWorkspaceName("");
        toast.success(`Workspace ${created.name} initialized`);
      },
      onError: () => {
        toast.error("Unable to initialize wiki workspace");
      },
    });
  }

  function handleIngest(payload: { title?: string; rawContent?: string; file?: File | null }) {
    ingestMutation.mutate(
      {
        workspace,
        title: payload.title,
        rawContent: payload.rawContent,
        file: payload.file ?? null,
      },
      {
        onSuccess: (response) => {
          const preferredPage = response.created_pages.find((page) => page.page_type !== "source_summary")
            ?? response.created_pages[0];
          setSelectedPageSlug(preferredPage?.slug ?? null);
          toast.success(`Ingested ${response.source_title}`);
        },
        onError: () => {
          toast.error("Wiki ingest failed");
        },
      },
    );
  }

  function handleQuery(question: string) {
    queryMutation.mutate(
      { workspace, question },
      {
        onSuccess: (response) => {
          setLastQueryResponse(response);
        },
        onError: () => {
          toast.error("Wiki query failed");
        },
      },
    );
  }

  function handleLint() {
    lintMutation.mutate(
      { workspace },
      {
        onSuccess: (response) => {
          setLastLintResponse(response);
        },
        onError: () => {
          toast.error("Wiki lint failed");
        },
      },
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_32%),#121216] p-4">
      <div className="rounded-2xl border border-white/[0.06] bg-[#15151a] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Commons Wiki
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              LLM-maintained knowledge base
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Browse durable wiki pages, ingest new source material, and ask the workspace for synthesized answers.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="h-4 w-4" />
              AI-backed workspace
            </div>
            <p className="mt-1 text-xs text-primary/80">
              Sources persist on disk and pages are regenerated incrementally.
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px,minmax(0,1fr),360px]">
        <WikiPageTree
          pages={pages}
          selectedSlug={selectedPageSlug}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={setSelectedPageSlug}
        />

        <WikiPageView page={pageQuery.data} onNavigate={setSelectedPageSlug} />

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <WikiWorkspaceSelector
            workspaces={workspaces}
            value={workspace}
            onChange={setWorkspace}
            draftValue={draftWorkspaceName}
            onDraftChange={setDraftWorkspaceName}
            onCreate={handleCreateWorkspace}
            creating={initWorkspace.isPending}
          />

          <WikiIngestPanel
            open={ingestPanelOpen}
            onToggle={() => setIngestPanelOpen(!ingestPanelOpen)}
            workspace={workspace}
            loading={ingestMutation.isPending}
            onSubmit={handleIngest}
          />

          <WikiQueryPanel
            open={queryPanelOpen}
            onToggle={() => setQueryPanelOpen(!queryPanelOpen)}
            loading={queryMutation.isPending}
            lintLoading={lintMutation.isPending}
            onSubmit={handleQuery}
            onLint={handleLint}
            response={lastQueryResponse}
            lint={lastLintResponse}
          />

          <WikiActivityFeed activity={activity} />
        </div>
      </div>
    </div>
  );
}

export function WikiPage() {
  const [mode, setMode] = useState<"ai" | "legacy">("ai");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] bg-[#111115] px-4 py-3">
        <div className="inline-flex rounded-2xl border border-white/[0.08] bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
              mode === "ai" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Wiki
          </button>
          <button
            type="button"
            onClick={() => setMode("legacy")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
              mode === "legacy" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PencilRuler className="h-4 w-4" />
            Legacy Wiki
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === "ai" ? <AiWikiPage /> : <LegacyWikiPage />}
      </div>
    </div>
  );
}
