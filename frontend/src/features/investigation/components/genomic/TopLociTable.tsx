import { useState } from "react";

interface TopLociRow {
  chr: string;
  pos: number;
  p: number;
  beta?: number;
  ref?: string;
  alt?: string;
}

interface TopLociTableProps {
  data: TopLociRow[];
  significanceThreshold?: number;
  onPinLocus?: (locus: { chr: string; pos: number; p: number }) => void;
}

type SortKey = "chr" | "pos" | "negLogP" | "beta";
type SortDir = "asc" | "desc";

function negLog10(p: number): number {
  if (p <= 0) return Infinity;
  return -Math.log10(p);
}

function formatP(p: number): string {
  if (p === 0) return "0";
  const exp = Math.floor(Math.log10(p));
  const mantissa = p / Math.pow(10, exp);
  return `${mantissa.toFixed(2)}e${exp}`;
}

export function TopLociTable({
  data,
  significanceThreshold = 5e-8,
  onPinLocus,
}: TopLociTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("negLogP");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const significant = data.filter((row) => row.p <= significanceThreshold);

  const sorted = [...significant].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    if (sortKey === "chr") {
      // Numeric chromosome sort (1-22 before X/Y/MT)
      const chrToNum = (c: string) => {
        const n = parseInt(c.replace(/^chr/i, ""), 10);
        return isNaN(n) ? 999 : n;
      };
      aVal = chrToNum(a.chr);
      bVal = chrToNum(b.chr);
    } else if (sortKey === "pos") {
      aVal = a.pos;
      bVal = b.pos;
    } else if (sortKey === "negLogP") {
      aVal = negLog10(a.p);
      bVal = negLog10(b.p);
    } else {
      aVal = a.beta ?? 0;
      bVal = b.beta ?? 0;
    }

    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "negLogP" ? "desc" : "asc");
    }
  }

  function SortIcon({ colKey }: { colKey: SortKey }) {
    if (sortKey !== colKey) {
      return (
        <span className="ml-1 text-zinc-600 text-[10px]">⇕</span>
      );
    }
    return (
      <span className="ml-1 text-[10px]" style={{ color: "#2DD4BF" }}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  const hasBeta = significant.some((r) => r.beta !== undefined);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "#2DD4BF" }}
        >
          Significant Loci
        </span>
        <span className="text-[11px] text-zinc-500">
          {significant.length} loci · threshold p &lt; {significanceThreshold.toExponential(0)}
        </span>
      </div>

      {significant.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface-darkest px-4 py-8 text-center text-sm text-zinc-500">
          No loci below significance threshold ({significanceThreshold.toExponential(0)})
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#18181b" }}>
                <th
                  className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-zinc-200 transition-colors"
                  onClick={() => handleSort("chr")}
                >
                  Chr <SortIcon colKey="chr" />
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-zinc-200 transition-colors"
                  onClick={() => handleSort("pos")}
                >
                  Position <SortIcon colKey="pos" />
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-zinc-200 transition-colors"
                  onClick={() => handleSort("negLogP")}
                >
                  -log₁₀(p) <SortIcon colKey="negLogP" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap">
                  p-value
                </th>
                {hasBeta && (
                  <th
                    className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-zinc-200 transition-colors"
                    onClick={() => handleSort("beta")}
                  >
                    Beta/OR <SortIcon colKey="beta" />
                  </th>
                )}
                <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap">
                  Ref/Alt
                </th>
                {onPinLocus && (
                  <th className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide text-center whitespace-nowrap">
                    Pin
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const nlp = negLog10(row.p);
                return (
                  <tr
                    key={`${row.chr}-${row.pos}-${idx}`}
                    className="border-t border-border-default hover:bg-surface-raised/30 transition-colors"
                    style={{ backgroundColor: "#09090b" }}
                  >
                    <td className="px-3 py-2 text-zinc-300 font-mono text-xs whitespace-nowrap">
                      {row.chr}
                    </td>
                    <td className="px-3 py-2 text-zinc-300 font-mono text-xs whitespace-nowrap">
                      {row.pos.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      <span
                        style={{
                          color: nlp >= 10 ? "#C9A227" : nlp >= 8 ? "#2DD4BF" : "#d4d4d8",
                          fontWeight: nlp >= 10 ? 600 : 400,
                        }}
                      >
                        {isFinite(nlp) ? nlp.toFixed(2) : "∞"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400 font-mono text-xs whitespace-nowrap">
                      {formatP(row.p)}
                    </td>
                    {hasBeta && (
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                        {row.beta !== undefined ? (
                          <span
                            style={{
                              color: row.beta > 0 ? "#2DD4BF" : row.beta < 0 ? "#9B1B30" : "#d4d4d8",
                            }}
                          >
                            {row.beta > 0 ? "+" : ""}
                            {row.beta.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs whitespace-nowrap">
                      {row.ref && row.alt ? `${row.ref}/${row.alt}` : "—"}
                    </td>
                    {onPinLocus && (
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() =>
                            onPinLocus({ chr: row.chr, pos: row.pos, p: row.p })
                          }
                          title="Pin this locus"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-border-default bg-surface-raised text-zinc-400 hover:border-teal-600 hover:text-teal-400 transition-colors text-xs"
                        >
                          📌
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
