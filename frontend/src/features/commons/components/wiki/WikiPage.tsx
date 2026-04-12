import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  History,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import {
  streamWikiQuery,
  useIngestWikiSource,
  useWikiActivity,
  useWikiLint,
  useWikiPage,
  useWikiPages,
  useWikiWorkspaces,
} from "../../api/wiki";
import { useAuthStore } from "@/stores/authStore";
import { useWikiStore } from "@/stores/wikiStore";
import { WikiActivityDrawer } from "./WikiActivityDrawer";
import { WikiChatDrawer } from "./WikiChatDrawer";
import { WikiChatPanel } from "./WikiChatPanel";
import { WikiIngestModal } from "./WikiIngestModal";
import { WikiPageTree } from "./WikiPageTree";
import { WikiPageView } from "./WikiPageView";
import { WikiPdfModal } from "./WikiPdfModal";

let _chatIdCounter = 0;
function chatId(): string {
  return `chat-${++_chatIdCounter}-${Date.now()}`;
}

const WORKSPACE = "platform";
const EMPTY_CHAT: never[] = [];

export function WikiPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const selectedPageSlug = useWikiStore((s) => s.selectedPageSlug);
  const searchQuery = useWikiStore((s) => s.searchQuery);
  const lintResponse = useWikiStore((s) => s.lintResponse);
  const ingestModalOpen = useWikiStore((s) => s.ingestModalOpen);
  const activityDrawerOpen = useWikiStore((s) => s.activityDrawerOpen);
  const pdfModalFilename = useWikiStore((s) => s.pdfModalFilename);
  const chatDrawerOpen = useWikiStore((s) => s.chatDrawerOpen);
  const setSelectedPageSlug = useWikiStore((s) => s.setSelectedPageSlug);
  const setSearchQuery = useWikiStore((s) => s.setSearchQuery);
  const setLintResponse = useWikiStore((s) => s.setLintResponse);
  const setIngestModalOpen = useWikiStore((s) => s.setIngestModalOpen);
  const setActivityDrawerOpen = useWikiStore((s) => s.setActivityDrawerOpen);
  const setPdfModalFilename = useWikiStore((s) => s.setPdfModalFilename);
  const setChatDrawerOpen = useWikiStore((s) => s.setChatDrawerOpen);
  const addChatMessage = useWikiStore((s) => s.addChatMessage);
  const appendToMessage = useWikiStore((s) => s.appendToMessage);
  const setCitationsOnMessage = useWikiStore((s) => s.setCitationsOnMessage);
  const clearChat = useWikiStore((s) => s.clearChat);

  // Debounce search for backend API calls (300ms)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Always fetch all pages — scrollable sidebar handles the UX
  const isSearching = debouncedSearch.trim().length > 0;

  useWikiWorkspaces(); // keep workspace initialized
  const pagesQuery = useWikiPages(WORKSPACE, debouncedSearch);
  const pageQuery = useWikiPage(WORKSPACE, selectedPageSlug);
  const activityQuery = useWikiActivity(WORKSPACE);
  const ingestMutation = useIngestWikiSource();
  const lintMutation = useWikiLint();
  const [streaming, setStreaming] = useState(false);

  const pagesResponse = pagesQuery.data;
  const pages = pagesResponse?.pages ?? [];
  const totalPages = pagesResponse?.total ?? 0;
  const activity = activityQuery.data ?? [];
  const lintIssues = lintResponse?.issues ?? [];
  const currentPage = pageQuery.data;
  const paperKey = currentPage?.source_slug ?? currentPage?.slug ?? WORKSPACE;
  const chatScopeId = userId ? `u${userId}:${paperKey}` : paperKey;
  const chatMessages = useWikiStore((s) => s.chatMessagesByScope[chatScopeId]) ?? EMPTY_CHAT;

  // Measured height of the chat messages content (reported by WikiChatPanel via ResizeObserver).
  // Used to size the chat wrapper so it claims exactly the space needed, up to 100%.
  const INPUT_BAR_HEIGHT = 70; // input bar + padding + scope label
  const [chatContentHeight, setChatContentHeight] = useState(0);
  const handleContentHeightChange = useCallback((height: number) => {
    setChatContentHeight(height);
  }, []);

  // Auto-select: latest ingested paper → last opened → first concept page
  const lastOpenedSlug = useWikiStore((s) => s.lastOpenedSlug);
  useEffect(() => {
    if (!pages.length) {
      if (selectedPageSlug) setSelectedPageSlug(null);
      return;
    }
    if (selectedPageSlug && pages.some((p) => p.slug === selectedPageSlug)) return;

    // 1. Latest ingested paper (highest ingested_at, prefer concept over source_summary)
    const withIngested = pages
      .filter((p) => p.ingested_at)
      .sort((a, b) => (b.ingested_at ?? "").localeCompare(a.ingested_at ?? ""));
    const latestIngested = withIngested.find((p) => p.page_type !== "source_summary") ?? withIngested[0];
    if (latestIngested) {
      setSelectedPageSlug(latestIngested.slug);
      return;
    }

    // 2. Last opened page (persisted across sessions)
    if (lastOpenedSlug && pages.some((p) => p.slug === lastOpenedSlug)) {
      setSelectedPageSlug(lastOpenedSlug);
      return;
    }

    // 3. Fallback: first concept page
    const preferred = pages.find((p) => p.page_type !== "source_summary") ?? pages[0];
    setSelectedPageSlug(preferred.slug);
  }, [pages, selectedPageSlug, lastOpenedSlug, setSelectedPageSlug]);

  // Auto-lint on load
  useEffect(() => {
    if (pages.length > 0 && !lintResponse) {
      lintMutation.mutate({ workspace: WORKSPACE }, { onSuccess: (r) => setLintResponse(r) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length > 0]);

  function handleIngest(payload: { title?: string; rawContent?: string; file?: File | null }) {
    ingestMutation.mutate(
      { workspace: WORKSPACE, title: payload.title, rawContent: payload.rawContent, file: payload.file ?? null },
      {
        onSuccess: (response) => {
          const preferred = response.created_pages.find((p) => p.page_type !== "source_summary") ?? response.created_pages[0];
          setSelectedPageSlug(preferred?.slug ?? null);
          setLintResponse(null);
          clearChat(response.source_slug);
          addChatMessage(response.source_slug, {
            id: chatId(),
            role: "assistant",
            content: `I ingested **${response.source_title}** into the Knowledge Base. Ask me to summarize it, compare it to other papers, or walk through methods and findings.`,
            citations: response.created_pages.filter((page) => page.source_slug === response.source_slug),
            timestamp: new Date().toISOString(),
          });
          setIngestModalOpen(false);
          setChatDrawerOpen(true);
          toast.success(`Ingested "${response.source_title}"`);
        },
        onError: () => toast.error("Ingest failed"),
      },
    );
  }

  function handleChatSend(question: string) {
    addChatMessage(chatScopeId, {
      id: chatId(),
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    });

    // Create an empty assistant message and stream tokens into it
    const assistantMsgId = chatId();
    addChatMessage(chatScopeId, {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    });

    setStreaming(true);
    streamWikiQuery(
      {
        workspace: WORKSPACE,
        question,
        pageSlug: currentPage?.slug ?? null,
        sourceSlug: currentPage?.source_slug ?? currentPage?.slug ?? null,
      },
      {
        onToken: (token) => {
          appendToMessage(chatScopeId, assistantMsgId, token);
        },
        onCitations: (citations) => {
          setCitationsOnMessage(chatScopeId, assistantMsgId, citations);
        },
        onDone: () => {
          setStreaming(false);
        },
      },
    ).catch(() => {
      appendToMessage(chatScopeId, assistantMsgId, "Sorry, I couldn't process that question.");
      setStreaming(false);
    });
  }

  function handleNavigate(slug: string) {
    setSelectedPageSlug(slug);
  }

  const isEmpty = pages.length === 0 && !pagesQuery.isLoading;
  const paperCount = totalPages > 0 ? totalPages : new Set(pages.map((p) => p.source_slug ?? p.slug)).size;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-base">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-border-default bg-surface-raised px-5 py-2.5">
        {/* Title */}
        <BookOpen size={18} className="text-success" />
        <h1 className="text-base font-bold text-text-primary">Knowledge Base</h1>
        {paperCount > 0 && (
          <span className="text-xs text-text-ghost">{paperCount} paper{paperCount !== 1 ? "s" : ""}</span>
        )}

        <div className="flex-1" />

        {/* Ingest */}
        <button
          type="button"
          onClick={() => setIngestModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success-dark"
        >
          <Upload size={14} />
          Ingest
        </button>

        {/* Lint badge */}
        {lintIssues.length > 0 && (
          <button
            type="button"
            onClick={() => { if (lintIssues[0]) setSelectedPageSlug(lintIssues[0].page_slug); }}
            className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
          >
            <AlertTriangle size={12} />
            {lintIssues.length}
          </button>
        )}

        {/* Activity */}
        <button
          type="button"
          onClick={() => setActivityDrawerOpen(true)}
          className="relative rounded-lg border border-border-default bg-surface-raised p-2 text-text-muted transition-colors hover:text-text-primary"
          title="Activity log"
        >
          <History size={16} />
          {activity.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[9px] font-bold text-surface-base">
              {activity.length > 9 ? "9+" : activity.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Main ───────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <BookOpen size={32} className="mx-auto mb-4 text-text-ghost" />
            <h2 className="text-xl font-bold text-text-primary">Knowledge Base</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Upload research papers, clinical guidelines, or any document.
              The AI will extract key information and make it searchable.
            </p>
            <button
              type="button"
              onClick={() => setIngestModalOpen(true)}
              disabled={ingestMutation.isPending}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-surface-base transition-colors hover:bg-success-dark"
            >
              <Upload size={16} />
              Add your first paper
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left: Paper list — search pinned at top, list scrolls independently */}
          <div className="flex w-[420px] shrink-0 flex-col overflow-hidden border-r border-border-default bg-surface-raised">
            {/* Search + header (pinned) */}
            <div className="shrink-0 border-b border-border-default bg-surface-overlay px-3 py-2.5">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search papers..."
                  className="w-full rounded-lg border border-border-default bg-surface-base py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-ghost outline-none transition-colors focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40"
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {isSearching ? "Results" : "Papers"} <span className="ml-1 text-text-ghost">{paperCount}</span>
              </p>
            </div>
            {/* Scrollable paper list */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <WikiPageTree
                pages={pages}
                selectedSlug={selectedPageSlug}
                searchQuery={searchQuery}
                onSelect={handleNavigate}
                lintIssues={lintIssues}
              />
            </div>
          </div>

          {/* Right: Content + Chat — chat claims measured height, paper header always visible */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-base">
            <div className="min-h-[120px] flex-1 overflow-auto">
              <WikiPageView
                page={pageQuery.data}
                onNavigate={handleNavigate}
                lintIssues={lintIssues}
                onViewSource={(filename) => setPdfModalFilename(filename)}
              />
            </div>
            <div
              className="flex min-h-0 flex-shrink-0 flex-col"
              style={
                chatMessages.length > 0 && chatContentHeight > 0
                  ? { flexBasis: `${chatContentHeight + INPUT_BAR_HEIGHT}px`, maxHeight: "calc(100% - 120px)" }
                  : undefined
              }
            >
              <WikiChatPanel
                messages={chatMessages}
                loading={streaming}
                onSend={handleChatSend}
                onNavigate={handleNavigate}
                onExpandChat={() => setChatDrawerOpen(true)}
                currentPageTitle={currentPage?.source_title ?? currentPage?.title}
                onContentHeightChange={handleContentHeightChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ───────────────────────────────────────── */}
      {ingestModalOpen && (
        <WikiIngestModal workspace={WORKSPACE} loading={ingestMutation.isPending} onSubmit={handleIngest} onClose={() => setIngestModalOpen(false)} />
      )}
      {activityDrawerOpen && (
        <WikiActivityDrawer activity={activity} onNavigate={handleNavigate} onClose={() => setActivityDrawerOpen(false)} />
      )}
      {pdfModalFilename && (
        <WikiPdfModal workspace={WORKSPACE} filename={pdfModalFilename} onClose={() => setPdfModalFilename(null)} />
      )}
      <WikiChatDrawer
        open={chatDrawerOpen}
        messages={chatMessages}
        loading={streaming}
        onSend={handleChatSend}
        onNavigate={handleNavigate}
        onClose={() => setChatDrawerOpen(false)}
        currentPageTitle={currentPage?.source_title ?? currentPage?.title}
      />
    </div>
  );
}
