import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
const INDEX_CLAIMS_COMMAND =
  "php artisan solr:index-claims"; // i18n-exempt: CLI command must remain exact.

const inputCls =
  "w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40 transition-colors";

const STATUS_COLORS: Record<string, string> = {
  paid: "var(--success)",
  submitted: "var(--info)",
  denied: "var(--critical)",
  pending: "var(--warning)",
  appealed: "#A855F7",
  adjusted: "var(--accent)",
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

function StatsCards({ stats }: { stats: Record<string, ClaimStats> }) {
  const { t } = useTranslation("app");
  const charge = stats.total_charge;
  const payment = stats.total_payment;
  const outstanding = stats.outstanding;

  if (!charge) return null;

  const cards = [
    {
      label: t("heor.claims.stats.totalCharges"),
      value: fmtCompact(charge.sum),
      sub: t("heor.common.count.claim", { count: charge.count }),
      color: "var(--warning)",
    },
    {
      label: t("heor.claims.stats.avgCharge"),
      value: fmtCompact(charge.mean),
      sub: t("heor.common.values.range", {
        min: fmtCompact(charge.min),
        max: fmtCompact(charge.max),
      }),
      color: "var(--accent)",
    },
    {
      label: t("heor.claims.stats.totalPayments"),
      value: fmtCompact(payment?.sum ?? 0),
      sub: t("heor.common.values.average", { value: fmtCompact(payment?.mean ?? 0) }),
      color: "var(--success)",
    },
    {
      label: t("heor.claims.stats.outstanding"),
      value: fmtCompact(outstanding?.sum ?? 0),
      sub: t("heor.common.values.average", { value: fmtCompact(outstanding?.mean ?? 0) }),
      color: (outstanding?.sum ?? 0) > 0 ? "var(--critical)" : "var(--success)",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
          <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium">{card.label}</p>
          <p className="text-lg font-semibold font-['IBM_Plex_Mono',monospace] mt-0.5" style={{ color: card.color }}>
            {card.value}
          </p>
          <p className="text-[10px] text-text-ghost mt-0.5">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}

function FacetPanel({
  facets,
  activeFilters,
  onFilter,
}: {
  facets: Record<string, Record<string, number>>;
  activeFilters: ClaimsSearchFilters;
  onFilter: (key: string, value: string | undefined) => void;
}) {
  const { t } = useTranslation("app");

  const facetConfig = [
    { key: "claim_status", label: t("heor.claims.facets.status"), filterKey: "status" },
    { key: "claim_type", label: t("heor.claims.facets.claimType"), filterKey: "type" },
    { key: "place_of_service", label: t("heor.claims.facets.placeOfService"), filterKey: "place_of_service" },
    { key: "diagnosis_codes", label: t("heor.claims.facets.diagnosisTop20"), filterKey: "diagnosis" },
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
              <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium">{label}</p>
              {activeValue && (
                <button
                  type="button"
                  onClick={() => onFilter(filterKey, undefined)}
                  className="text-[10px] text-critical hover:text-critical transition-colors"
                >
                  {t("heor.common.actions.clear")}
                </button>
              )}
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {entries.map(([value, count]) => {
                const isActive = activeValue === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onFilter(filterKey, isActive ? undefined : value)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      isActive
                        ? "bg-success/15 text-success"
                        : "text-text-muted hover:text-text-secondary hover:bg-surface-overlay"
                    }`}
                  >
                    <span className="flex-1 truncate text-left">{value}</span>
                    <span className="font-mono text-[10px] text-text-ghost flex-shrink-0">
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

function ClaimsTable({ items }: { items: ClaimItem[] }) {
  const { t } = useTranslation("app");

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised p-10 text-center text-sm text-text-ghost">
        {t("heor.common.messages.noClaimsMatch")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-raised border-b border-border-default">
            <th className="text-left px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.patient")}
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.date")}
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.type")}
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.status")}
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.diagnosis")}
            </th>
            <th className="text-right px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.charge")}
            </th>
            <th className="text-right px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.payment")}
            </th>
            <th className="text-right px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.outstanding")}
            </th>
            <th className="text-center px-3 py-2.5 text-[10px] text-text-ghost uppercase tracking-wider font-medium">
              {t("heor.common.labels.transactions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((item) => (
            <tr key={item.claim_id} className="hover:bg-surface-overlay transition-colors">
              <td className="px-3 py-2">
                <p className="text-text-primary font-medium truncate max-w-[140px]">
                  {item.patient_name}
                </p>
                <p className="text-[10px] text-text-ghost">
                  {t("heor.common.labels.id")}: {item.patient_id}
                </p>
              </td>
              <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                {item.service_date ? new Date(item.service_date).toLocaleDateString() : "—"}
              </td>
              <td className="px-3 py-2">
                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-surface-elevated text-text-muted">
                  {item.claim_type}
                </span>
              </td>
              <td className="px-3 py-2">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor:
                      (STATUS_COLORS[item.claim_status?.toLowerCase()] ?? "var(--text-ghost)") + "20",
                    color: STATUS_COLORS[item.claim_status?.toLowerCase()] ?? "var(--text-muted)",
                  }}
                >
                  {item.claim_status}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="max-w-[180px]">
                  {item.diagnosis_names?.slice(0, 2).map((diagnosis, index) => (
                    <p key={index} className="text-xs text-text-muted truncate">{diagnosis}</p>
                  ))}
                  {(item.diagnosis_names?.length ?? 0) > 2 && (
                    <p className="text-[10px] text-text-ghost">
                      {t("heor.common.values.moreCount", {
                        count: item.diagnosis_names.length - 2,
                      })}
                    </p>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-warning whitespace-nowrap">
                {fmt(item.total_charge)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-success whitespace-nowrap">
                {fmt(item.total_payment)}
              </td>
              <td
                className="px-3 py-2 text-right font-mono whitespace-nowrap"
                style={{
                  color: (item.outstanding ?? 0) > 0 ? "var(--critical)" : "var(--text-ghost)",
                }}
              >
                {fmt(item.outstanding)}
              </td>
              <td className="px-3 py-2 text-center text-text-ghost">
                {item.transaction_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClaimsExplorer() {
  const { t } = useTranslation("app");
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
    setFilters((prev) => ({ ...prev, offset: 0 }));
  };

  const handleFacetFilter = (key: string, value: string | undefined) => {
    setFilters((prev) => {
      const next = { ...prev, offset: 0 } as Record<string, unknown>;
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next as ClaimsSearchFilters;
    });
  };

  const handlePage = (dir: "prev" | "next") => {
    setFilters((prev) => ({
      ...prev,
      offset:
        dir === "next"
          ? (prev.offset ?? 0) + PAGE_SIZE
          : Math.max(0, (prev.offset ?? 0) - PAGE_SIZE),
    }));
  };

  const activeFilterCount = [
    filters.status,
    filters.type,
    filters.place_of_service,
    filters.diagnosis,
    filters.date_from,
    filters.date_to,
    filters.min_charge,
    filters.max_charge,
    filters.has_outstanding,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilters({ limit: PAGE_SIZE, offset: 0 });
    setSearchInput("");
  };

  if (data?.engine === "unavailable") {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-6 py-8 text-center">
        <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
        <p className="text-sm text-amber-400 font-medium">{t("heor.common.messages.solrUnavailable")}</p>
        <p className="text-xs text-text-muted mt-1">
          {t("heor.common.messages.runCommandPrefix")}{" "}
          <code className="bg-surface-base px-1.5 py-0.5 rounded text-text-secondary">
            {INDEX_CLAIMS_COMMAND}
          </code>{" "}
          {t("heor.common.messages.runCommandSuffix")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {t("heor.common.messages.claimsSearchDescription")}
          {data?.engine === "solr" && (
            <span className="ml-1.5 text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded">
              {t("heor.common.messages.solrAccelerated")}
            </span>
          )}
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
          <input
            className={inputCls + " pl-9"}
            placeholder={t("heor.common.placeholders.claimsSearch")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors"
        >
          <Search size={13} />
          {t("heor.common.actions.search")}
        </button>
        {(activeFilterCount > 0 || searchInput) && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 rounded-lg border border-border-default px-3 py-2 text-xs text-text-muted hover:text-critical hover:border-critical/30 transition-colors"
          >
            <X size={12} />
            {t("heor.common.actions.clear")}
            {activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
        )}
      </form>

      {data?.stats && Object.keys(data.stats).length > 0 && <StatsCards stats={data.stats} />}

      <div className="flex gap-4">
        {data?.facets && Object.keys(data.facets).length > 0 && (
          <div className="w-56 flex-shrink-0">
            <div className="rounded-lg border border-border-default bg-surface-raised p-3 sticky top-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Filter size={12} className="text-text-ghost" />
                <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium">
                  {t("heor.common.labels.filters")}
                </p>
              </div>
              <FacetPanel facets={data.facets} activeFilters={filters} onFilter={handleFacetFilter} />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-ghost">
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  {t("heor.common.messages.searching")}
                </span>
              ) : (
                <>
                  {t("heor.common.count.claim", { count: total })}
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
                  className="p-1 rounded text-text-ghost hover:text-text-secondary disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-text-ghost">
                  {t("heor.common.labels.page")} {page} of {totalPages.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => handlePage("next")}
                  disabled={page >= totalPages}
                  className="p-1 rounded text-text-ghost hover:text-text-secondary disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {!isLoading && <ClaimsTable items={data?.items ?? []} />}

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-success" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
