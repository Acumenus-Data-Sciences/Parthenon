import { useState } from "react";
import { Bot } from "lucide-react";
import type { WikiQueryResponse } from "../../types/wiki";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function WikiQueryPanel({
  loading,
  onSubmit,
  onNavigate,
  response,
}: {
  loading: boolean;
  onSubmit: (question: string) => void;
  onNavigate: (slug: string) => void;
  response: WikiQueryResponse | null;
}) {
  const [question, setQuestion] = useState("");

  function handleSubmit() {
    if (question.trim().length < 3) return;
    onSubmit(question);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] p-4">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the wiki what it knows..."
          rows={3}
          className="w-full rounded-lg border border-white/[0.08] bg-[#111115] px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || question.trim().length < 3}
          className="mt-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Asking..." : "Ask wiki"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {response ? (
          <div className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bot className="h-4 w-4 text-primary" />
              Answer
            </div>
            <div className="mt-3 text-sm leading-6 text-muted-foreground">
              <MarkdownRenderer markdown={response.answer} onNavigate={onNavigate} />
            </div>
            {!!response.citations.length && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Sources
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {response.citations.map((citation) => (
                    <button
                      key={citation.slug}
                      type="button"
                      onClick={() => onNavigate(citation.slug)}
                      className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                    >
                      {citation.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">Ask a question</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              The wiki will synthesize an answer from ingested sources.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
