import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DataInterrogationResponse } from '../../types/abby';

interface DataInterrogationResultProps {
  result: DataInterrogationResponse;
}

export function DataInterrogationResult({
  result,
}: DataInterrogationResultProps) {
  const [showSql, setShowSql] = useState(false);

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-sm text-red-400">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Answer */}
      <div className="prose prose-invert prose-sm max-w-none [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_table]:border-collapse [&_th]:border [&_th]:border-white/10 [&_td]:border [&_td]:border-white/10 [&_th]:bg-white/5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {result.answer}
        </ReactMarkdown>
      </div>

      {/* SQL queries (collapsible) */}
      {result.queries.length > 0 && (
        <div>
          <button
            onClick={() => setShowSql(!showSql)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <span
              className={`transition-transform ${showSql ? 'rotate-90' : ''}`}
            >
              ▶
            </span>
            {result.queries.length} {result.queries.length === 1 ? 'query' : 'queries'} executed
            {result.iterations > 1 && ` (${result.iterations} steps)`}
          </button>

          {showSql && (
            <div className="mt-2 space-y-2">
              {result.queries.map((sql, i) => (
                <pre
                  key={i}
                  className="rounded bg-black/40 p-3 text-xs text-teal-400/80 overflow-x-auto border border-white/5"
                >
                  <code>{sql}</code>
                </pre>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
