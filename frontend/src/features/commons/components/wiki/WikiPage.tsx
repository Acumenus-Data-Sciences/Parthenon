import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  History,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import {
  useIngestWikiSource,
  useWikiActivity,
  useWikiLint,
  useWikiPage,
  useWikiPages,
  useWikiQuery,
  useWikiWorkspaces,
} from "../../api/wiki";
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

export function WikiPage() {
  const selectedPageSlug = useWikiStore((s) => s.selectedPageSlug);
  const searchQuery = useWikiStore((s) => s.searchQuery);
  const lintResponse = useWikiStore((s) => s.lintResponse);
  const ingestModalOpen = useWikiStore((s) => s.ingestModalOpen);
  const activityDrawerOpen = useWikiStore((s) => s.activityDrawerOpen);
  const pdfModalFilename = useWikiStore((s) => s.pdfModalFilename);
  const chatDrawerOpen = useWikiStore((s) => s.chatDrawerOpen);
  const chatMessages = useWikiStore((s) => s.chatMessages);
  const setSelectedPageSlug = useWikiStore((s) => s.setSelectedPageSlug);
  const setSearchQuery = useWikiStore((s) => s.setSearchQuery);
  const setLintResponse = useWikiStore((s) => s.setLintResponse);
  const setIngestModalOpen = useWikiStore((s) => s.setIngestModalOpen);
  const setActivityDrawerOpen = useWikiStore((s) => s.setActivityDrawerOpen);
  const setPdfModalFilename = useWikiStore((s) => s.setPdfModalFilename);
  const setChatDrawerOpen = useWikiStore((s) => s.setChatDrawerOpen);
  const addChatMessage = useWikiStore((s) => s.addChatMessage);

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
  const queryMutation = useWikiQuery();
  const lintMutation = useWikiLint();

  const pagesResponse = pagesQuery.data;
  const pages = pagesResponse?.pages ?? [];
  const totalPages = pagesResponse?.total ?? 0;
  const activity = activityQuery.data ?? [];
  const lintIssues = lintResponse?.issues ?? [];

  // Auto-select first page (prefer concept over source_summary)
  useEffect(() => {
    if (!pages.length) {
      if (selectedPageSlug) setSelectedPageSlug(null);
      return;
    }
    if (!selectedPageSlug || !pages.some((p) => p.slug === selectedPageSlug)) {
      const preferred = pages.find((p) => p.page_type !== "source_summary") ?? pages[0];
      setSelectedPageSlug(preferred.slug);
    }
  }, [pages, selectedPageSlug, setSelectedPageSlug]);

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
          setIngestModalOpen(false);
          toast.success(`Ingested "${response.source_title}"`);
        },
        onError: () => toast.error("Ingest failed"),
      },
    );
  }

  function handleChatSend(question: string) {
    // Include the currently selected page's title as context so the LLM knows
    // which document the user is looking at
    const currentPage = pageQuery.data;
    const contextualQuestion = currentPage
      ? `[Context: The user is viewing "${currentPage.title}"]\n\n${question}`
      : question;

    addChatMessage({ id: chatId(), role: "user", content: question, timestamp: new Date().toISOString() });
    queryMutation.mutate(
      { workspace: WORKSPACE, question: contextualQuestion },
      {
        onSuccess: (response) => {
          addChatMessage({ id: chatId(), role: "assistant", content: response.answer, citations: response.citations, timestamp: new Date().toISOString() });
        },
        onError: () => {
          addChatMessage({ id: chatId(), role: "assistant", content: "Sorry, I couldn't process that question.", timestamp: new Date().toISOString() });
        },
      },
    );
  }

  function handleNavigate(slug: string) {
    setSelectedPageSlug(slug);
  }

  const isEmpty = pages.length === 0 && !pagesQuery.isLoading;
  const paperCount = totalPages > 0 ? totalPages : new Set(pages.map((p) => p.source_slug ?? p.slug)).size;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0E0E11]">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[#232328] bg-[#151518] px-5 py-2.5">
        {/* Title */}
        <BookOpen size={18} className="text-[#2DD4BF]" />
        <h1 className="text-base font-bold text-[#F0EDE8]">Knowledge Base</h1>
        {paperCount > 0 && (
          <span className="text-xs text-[#5A5650]">{paperCount} paper{paperCount !== 1 ? "s" : ""}</span>
        )}

        <div className="flex-1" />

        {/* Ingest */}
        <button
          type="button"
          onClick={() => setIngestModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-3 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5]"
        >
          <Upload size={14} />
          Ingest
        </button>

        {/* Lint badge */}
        {lintIssues.length > 0 && (
          <button
            type="button"
            onClick={() => { if (lintIssues[0]) setSelectedPageSlug(lintIssues[0].page_slug); }}
            className="inline-flex items-center gap-1 rounded-full border border-[#C9A227]/20 bg-[#C9A227]/5 px-2.5 py-1 text-[11px] font-medium text-[#C9A227] transition-colors hover:bg-[#C9A227]/10"
          >
            <AlertTriangle size={12} />
            {lintIssues.length}
          </button>
        )}

        {/* Activity */}
        <button
          type="button"
          onClick={() => setActivityDrawerOpen(true)}
          className="relative rounded-lg border border-[#232328] bg-[#151518] p-2 text-[#8A857D] transition-colors hover:text-[#F0EDE8]"
          title="Activity log"
        >
          <History size={16} />
          {activity.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2DD4BF] text-[9px] font-bold text-[#0E0E11]">
              {activity.length > 9 ? "9+" : activity.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Main ───────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <BookOpen size={32} className="mx-auto mb-4 text-[#323238]" />
            <h2 className="text-xl font-bold text-[#F0EDE8]">Knowledge Base</h2>
            <p className="mt-2 text-sm leading-6 text-[#8A857D]">
              Upload research papers, clinical guidelines, or any document.
              The AI will extract key information and make it searchable.
            </p>
            <button
              type="button"
              onClick={() => setIngestModalOpen(true)}
              disabled={ingestMutation.isPending}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5]"
            >
              <Upload size={16} />
              Add your first paper
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left: Paper list */}
          <div className="flex w-[300px] shrink-0 flex-col border-r border-[#232328] bg-[#151518]">
            {/* Search + header */}
            <div className="shrink-0 border-b border-[#232328] bg-[#1C1C20] px-3 py-2.5">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search papers..."
                  className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] py-2 pl-9 pr-3 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] outline-none transition-colors focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40"
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                {isSearching ? "Results" : "Papers"} <span className="ml-1 text-[#5A5650]">{paperCount}</span>
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <WikiPageTree
                pages={pages}
                selectedSlug={selectedPageSlug}
                searchQuery={searchQuery}
                onSelect={handleNavigate}
                lintIssues={lintIssues}
              />
            </div>
          </div>

          {/* Right: Content + Chat at bottom */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0E0E11]">
            <div className="min-h-0 flex-1 overflow-hidden">
              <WikiPageView
                page={pageQuery.data}
                onNavigate={handleNavigate}
                lintIssues={lintIssues}
                onViewSource={(filename) => setPdfModalFilename(filename)}
              />
            </div>
            <WikiChatPanel
              messages={chatMessages}
              loading={queryMutation.isPending}
              onSend={handleChatSend}
              onNavigate={handleNavigate}
              onExpandChat={() => setChatDrawerOpen(true)}
              currentPageTitle={pageQuery.data?.title}
            />
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
        loading={queryMutation.isPending}
        onSend={handleChatSend}
        onNavigate={handleNavigate}
        onClose={() => setChatDrawerOpen(false)}
        currentPageTitle={pageQuery.data?.title}
      />
    </div>
  );
}
