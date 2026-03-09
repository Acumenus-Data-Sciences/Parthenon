import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
} from "lucide-react";
import { useClaimsSearch } from "../hooks/useClaims";
import type { ClaimsSearchFilters, ClaimItem, ClaimStats } from "../api/claimsApi";

const PAGE_SIZE = 25;

const inputCls =
  "w-full rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors";

const STATUS_COLORS: Record<string, string> = {
  paid: "#2DD4BF",
  submitted: "#60A5FA",
  denied: "#E85A6B",
  pending: "#F59E0B",
  appealed: "#A855F7",
  adjusted: "#C9A227",
};

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

/* ─── Stats Cards ─── */
function StatsCards({ stats }: { stats: Record<string, ClaimStats> }) {
  const charge = stats.total_charge;
  const payment = stats.total_payment;
  const outstanding = stats.outstanding;

  if (!charge) return null;

  const cards = [
    { label: "Total Charges", value: fmtCompact(charge.sum), sub: `${charge.count.toLocaleString()} claims`, color: "#F59E0B" },
    { label: "Avg Charge", value: fmtCompact(charge.mean), sub: `${fmtCompact(charge.min)} – ${fmtCompact(charge.max)}`, color: "#C9A227" },
    { label: "Total Payments", value: fmtCompact(payment?.sum ?? 0), sub: `Avg: ${fmtCompact(payment?.mean ?? 0)}`, color: "#2DD4BF" },
    { label: "Outstanding", value: fmtCompact(outstanding?.sum ?? 0), sub: `Avg: ${fmtCompact(outstanding?.mean ?? 0)}`, color: outstanding?.sum > 0 ? "#E85A6B" : "#2DD4BF" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
          <p className="text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">{c.label}</p>
          <p className="text-lg font-semibold font-['IBM_Plex_Mono',monospace] mt-0.5" style={{ color: c.color }}>
            {c.value}
          </p>
          <p className="text-[10px] text-[#5A5650] mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Facet Sidebar ─── */
function FacetPanel({
  facets,
  activeFilters,
  onFilter,
}: {
  facets: Record<string, Record<string, number>>;
  activeFilters: ClaimsSearchFilters;
  onFilter: (key: string, value: string | undefined) => void;
}) {
  const facetConfig = [
    { key: "claim_status", label: "Status", filterKey: "status" },
    { key: "claim_type", label: "Claim Type", filterKey: "type" },
    { key: "place_of_service", label: "Place of Service", filterKey: "place_of_service" },
    { key: "diagnosis_codes", label: "Diagnosis (Top 20)", filterKey: "diagnosis" },
  ];

  return (
    <div className="space-y-4">
      {facetConfig.map(({ key, label, filterKey }) => {
        const buckets = facets[key];
        if (!buckets || Object.keys(buckets).length === 0) return null;

        const activeValue = (activeFilters as Record<string, unknown>)[filterKey] as string | undefined;
        const entries = Object.entries(buckets).slice(0, key === "diagnosis_codes" ? 20 : 50);

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">{label}</p>
              {activeValue && (
                <button
                  type="button"
                  onClick={() => onFilter(filterKey, undefined)}
                  className="text-[10px] text-[#E85A6B] hover:text-[#F87171] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {entries.map(([val, count]) => {
                const isActive = activeValue === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onFilter(filterKey, isActive ? undefined : val)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      isActive
                        ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                        : "text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#1A1A1E]"
                    }`}
                  >
                    <span className="flex-1 truncate text-left">{val}</span>
                    <span className="font-mono text-[10px] text-[#5A5650] flex-shrink-0">
                      {count.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Results Table ─── */
function ClaimsTable({ items }: { items: ClaimItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-10 text-center text-sm text-[#5A5650]">
        No claims match your search criteria.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#232328]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#151518] border-b border-[#232328]">
            <th className="text-left px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Patient
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Date
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Type
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Status
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Diagnosis
            </th>
            <th className="text-right px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Charge
            </th>
            <th className="text-right px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Payment
            </th>
            <th className="text-right px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Outstanding
            </th>
            <th className="text-center px-3 py-2.5 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
              Txns
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1E1E23]">
          {items.map((item) => (
            <tr key={item.claim_id} className="hover:bg-[#1A1A1F] transition-colors">
              <td className="px-3 py-2">
                <p className="text-[#F0EDE8] font-medium truncate max-w-[140px]">
                  {item.patient_name}
                </p>
                <p className="text-[10px] text-[#5A5650]">ID: {item.patient_id}</p>
              </td>
              <td className="px-3 py-2 text-[#C5C0B8] whitespace-nowrap">
                {item.service_date ? new Date(item.service_date).toLocaleDateString() : "—"}
              </td>
              <td className="px-3 py-2">
                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#232328] text-[#8A857D]">
                  {item.claim_type}
                </span>
              </td>
              <td className="px-3 py-2">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: (STATUS_COLORS[item.claim_status?.toLowerCase()] ?? "#5A5650") + "20",
                    color: STATUS_COLORS[item.claim_status?.toLowerCase()] ?? "#8A857D",
                  }}
                >
                  {item.claim_status}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="max-w-[180px]">
                  {item.diagnosis_names?.slice(0, 2).map((dx, i) => (
                    <p key={i} className="text-xs text-[#8A857D] truncate">{dx}</p>
                  ))}
                  {(item.diagnosis_names?.length ?? 0) > 2 && (
                    <p className="text-[10px] text-[#5A5650]">
                      +{item.diagnosis_names.length - 2} more
                    </p>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-[#F59E0B] whitespace-nowrap">
                {fmt(item.total_charge)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-[#2DD4BF] whitespace-nowrap">
                {fmt(item.total_payment)}
              </td>
              <td className="px-3 py-2 text-right font-mono whitespace-nowrap" style={{
                color: (item.outstanding ?? 0) > 0 ? "#E85A6B" : "#5A5650",
              }}>
                {fmt(item.outstanding)}
              </td>
              <td className="px-3 py-2 text-center text-[#5A5650]">
                {item.transaction_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Component ─── */
export default function ClaimsExplorer() {
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<ClaimsSearchFilters>({
    limit: PAGE_SIZE,
    offset: 0,
  });

  const activeFilters = useMemo(
    () => ({ ...filters, q: searchInput || undefined }),
    [filters, searchInput],
  );

  const { data, isLoading, isFetching } = useClaimsSearch(activeFilters);

  const total = data?.total ?? 0;
  const page = Math.floor((filters.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, offset: 0 }));
  };

  const handleFacetFilter = (key: string, value: string | undefined) => {
    setFilters((f) => {
      const next = { ...f, offset: 0 } as Record<string, unknown>;
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next as ClaimsSearchFilters;
    });
  };

  const handlePage = (dir: "prev" | "next") => {
    setFilters((f) => ({
      ...f,
      offset: dir === "next" ? (f.offset ?? 0) + PAGE_SIZE : Math.max(0, (f.offset ?? 0) - PAGE_SIZE),
    }));
  };

  const activeFilterCount = [
    filters.status, filters.type, filters.place_of_service,
    filters.diagnosis, filters.date_from, filters.date_to,
    filters.min_charge, filters.max_charge, filters.has_outstanding,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilters({ limit: PAGE_SIZE, offset: 0 });
    setSearchInput("");
  };

  // Unavailable state
  if (data?.engine === "unavailable") {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-6 py-8 text-center">
        <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
        <p className="text-sm text-amber-400 font-medium">Solr Claims Core Not Available</p>
        <p className="text-xs text-[#8A857D] mt-1">
          Run <code className="bg-[#0E0E11] px-1.5 py-0.5 rounded text-[#C5C0B8]">php artisan solr:index-claims</code> to
          index claims data for search.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8A857D]">
          Search and analyze healthcare claims with faceted navigation and financial aggregations.
          {data?.engine === "solr" && (
            <span className="ml-1.5 text-[10px] text-[#2DD4BF] bg-[#2DD4BF]/10 px-1.5 py-0.5 rounded">
              Solr-accelerated
            </span>
          )}
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
          <input
            className={inputCls + " pl-9"}
            placeholder="Search claims by patient, diagnosis, procedure, notes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
        >
          <Search size={13} />
          Search
        </button>
        {(activeFilterCount > 0 || searchInput) && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 rounded-lg border border-[#232328] px-3 py-2 text-xs text-[#8A857D] hover:text-[#E85A6B] hover:border-[#E85A6B]/30 transition-colors"
          >
            <X size={12} />
            Clear {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        )}
      </form>

      {/* Stats cards */}
      {data?.stats && Object.keys(data.stats).length > 0 && <StatsCards stats={data.stats} />}

      {/* Main layout: facets sidebar + results */}
      <div className="flex gap-4">
        {/* Facet sidebar */}
        {data?.facets && Object.keys(data.facets).length > 0 && (
          <div className="w-56 flex-shrink-0">
            <div className="rounded-lg border border-[#232328] bg-[#151518] p-3 sticky top-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Filter size={12} className="text-[#5A5650]" />
                <p className="text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">Filters</p>
              </div>
              <FacetPanel facets={data.facets} activeFilters={filters} onFilter={handleFacetFilter} />
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Results header */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#5A5650]">
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Searching…
                </span>
              ) : (
                <>
                  {total.toLocaleString()} claim{total !== 1 ? "s" : ""} found
                  {isFetching && <Loader2 size={10} className="inline animate-spin ml-1.5" />}
                </>
              )}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePage("prev")}
                  disabled={page <= 1}
                  className="p-1 rounded text-[#5A5650] hover:text-[#C5C0B8] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-[#5A5650]">
                  Page {page} of {totalPages.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => handlePage("next")}
                  disabled={page >= totalPages}
                  className="p-1 rounded text-[#5A5650] hover:text-[#C5C0B8] disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          {!isLoading && <ClaimsTable items={data?.items ?? []} />}

          {/* Loading placeholder */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
