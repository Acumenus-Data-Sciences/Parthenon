import { useState } from "react";
import { Bot, ChevronDown, AlertTriangle } from "lucide-react";
import type { WikiLintResponse, WikiQueryResponse } from "../../types/wiki";

export function WikiQueryPanel({
  open,
  onToggle,
  loading,
  lintLoading,
  onSubmit,
  onLint,
  response,
  lint,
}: {
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  lintLoading: boolean;
  onSubmit: (question: string) => void;
  onLint: () => void;
  response: WikiQueryResponse | null;
  lint: WikiLintResponse | null;
}) {
  const [question, setQuestion] = useState("");

  function handleSubmit() {
    onSubmit(question);
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#15151a]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Query & Lint</p>
          <p className="text-xs text-muted-foreground">Ask the wiki a question or run structural checks</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask the wiki what it knows..."
            rows={4}
            className="w-full rounded-xl border border-white/[0.08] bg-[#111115] px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
          />

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || question.trim().length < 3}
              className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Asking..." : "Ask wiki"}
            </button>
            <button
              type="button"
              onClick={onLint}
              disabled={lintLoading}
              className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white/[0.04] disabled:opacity-50"
            >
              {lintLoading ? "Linting..." : "Lint"}
            </button>
          </div>

          {response && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bot className="h-4 w-4 text-primary" />
                Wiki Answer
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{response.answer}</p>
              {!!response.citations.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {response.citations.map((citation) => (
                    <span
                      key={citation.slug}
                      className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      {citation.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {lint && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Lint Results
              </div>
              {lint.issues.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No structural issues detected.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {lint.issues.map((issue) => (
                    <div
                      key={`${issue.page_slug}-${issue.message}`}
                      className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                        {issue.severity}
                      </p>
                      <p className="mt-1 text-sm text-foreground">{issue.page_slug}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{issue.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
