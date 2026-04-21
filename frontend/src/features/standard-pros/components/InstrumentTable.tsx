import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Minus,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProInstrument, OmopCoverage } from "../types/proInstrument";
import { DOMAIN_COLORS, OMOP_COLORS } from "../types/proInstrument";
import {
  standardProsCatalogDomainLabel,
  standardProsLicenseLabel,
  standardProsOmopLabel,
} from "../lib/i18n";

interface InstrumentTableProps {
  instruments: ProInstrument[];
}

type SortField = "abbreviation" | "name" | "domain" | "items" | "omopCoverage" | "license";
type SortDir = "asc" | "desc";

function OmopBadge({ coverage }: { coverage: OmopCoverage }) {
  const { t } = useTranslation("app");
  const label = standardProsOmopLabel(t, coverage);
  const Icon = coverage === "yes" ? Check : coverage === "partial" ? Minus : X;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: `${OMOP_COLORS[coverage]}15`,
        color: OMOP_COLORS[coverage],
      }}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}

function LoincBadge({ hasLoinc, code }: { hasLoinc: boolean; code: string | null }) {
  const { t } = useTranslation("app");
  if (!hasLoinc) {
    return <span className="text-[10px] text-text-ghost">{"\u2014"}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
      <Check size={10} />
      {code ?? t("standardPros.common.yes")}
    </span>
  );
}

function Pill({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
        active
          ? "text-surface-base"
          : "bg-surface-overlay text-text-muted hover:text-text-secondary hover:bg-surface-elevated",
      )}
      style={active ? { backgroundColor: color ?? "var(--accent)" } : undefined}
    >
      {label}
    </button>
  );
}

export function InstrumentTable({ instruments }: InstrumentTableProps) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [omopFilter, setOmopFilter] = useState<OmopCoverage | null>(null);
  const [licenseFilter, setLicenseFilter] = useState<"public" | "proprietary" | null>(null);
  const [loincFilter, setLoincFilter] = useState<boolean | null>(null);
  const [snomedFilter, setSnomedFilter] = useState<boolean | null>(null);
  const [sortField, setSortField] = useState<SortField>("domain");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const domains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inst of instruments) {
      counts.set(inst.domain, (counts.get(inst.domain) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({ domain, count }));
  }, [instruments]);

  const filtered = useMemo(() => {
    let list = instruments;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.abbreviation.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          i.domain.toLowerCase().includes(q),
      );
    }
    if (domainFilter) list = list.filter((i) => i.domain === domainFilter);
    if (omopFilter) list = list.filter((i) => i.omopCoverage === omopFilter);
    if (licenseFilter) list = list.filter((i) => i.license === licenseFilter);
    if (loincFilter !== null) list = list.filter((i) => i.hasLoinc === loincFilter);
    if (snomedFilter !== null) list = list.filter((i) => i.hasSnomed === snomedFilter);

    const sorted = [...list].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [instruments, search, domainFilter, omopFilter, licenseFilter, loincFilter, snomedFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortOptions: { field: SortField; label: string }[] = [
    { field: "domain", label: t("standardPros.common.domain") },
    { field: "abbreviation", label: t("standardPros.common.abbreviation") },
    { field: "name", label: t("standardPros.common.name") },
    { field: "items", label: t("standardPros.common.items") },
    { field: "omopCoverage", label: t("standardPros.common.omop") },
    { field: "license", label: t("standardPros.common.license") },
  ];

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="w-3" />;
    return sortDir === "asc" ? (
      <ChevronUp size={12} className="text-accent" />
    ) : (
      <ChevronDown size={12} className="text-accent" />
    );
  };

  const activeFilterCount =
    (domainFilter ? 1 : 0) +
    (omopFilter ? 1 : 0) +
    (licenseFilter ? 1 : 0) +
    (loincFilter !== null ? 1 : 0) +
    (snomedFilter !== null ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* ── Search bar ────────────────────────────────────────────────── */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
        />
        <input
          type="text"
          placeholder={t("standardPros.table.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border-default bg-surface-base py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-ghost outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      {/* ── Filter + Sort pills ───────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Domain pills */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-ghost uppercase tracking-wider shrink-0 w-14">
            {t("standardPros.common.domain")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Pill
              active={!domainFilter}
              label={t("standardPros.common.all")}
              color="var(--accent)"
              onClick={() => setDomainFilter(null)}
            />
            {domains.map(({ domain, count }) => (
              <Pill
                key={domain}
                active={domainFilter === domain}
                label={`${standardProsCatalogDomainLabel(t, domain)} (${count})`}
                color={DOMAIN_COLORS[domain]}
                onClick={() => setDomainFilter(domainFilter === domain ? null : domain)}
              />
            ))}
          </div>
        </div>

        {/* OMOP + License + LOINC + Sort row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* OMOP */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-ghost uppercase tracking-wider">
              {t("standardPros.common.omop")}
            </span>
            {(["yes", "partial", "no"] as const).map((v) => (
              <Pill
                key={v}
                active={omopFilter === v}
                label={standardProsOmopLabel(t, v)}
                color={OMOP_COLORS[v]}
                onClick={() => setOmopFilter(omopFilter === v ? null : v)}
              />
            ))}
          </div>

          <span className="text-text-disabled">|</span>

          {/* License */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-ghost uppercase tracking-wider">{t("standardPros.common.license")}</span>
            <Pill
              active={licenseFilter === "public"}
              label={t("standardPros.common.public")}
              color="var(--success)"
              onClick={() => setLicenseFilter(licenseFilter === "public" ? null : "public")}
            />
            <Pill
              active={licenseFilter === "proprietary"}
              label={t("standardPros.common.proprietary")}
              color="var(--accent)"
              onClick={() => setLicenseFilter(licenseFilter === "proprietary" ? null : "proprietary")}
            />
          </div>

          <span className="text-text-disabled">|</span>

          {/* LOINC */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-ghost uppercase tracking-wider">{t("standardPros.instrumentDetail.loinc")}</span>
            <Pill
              active={loincFilter === true}
              label={t("standardPros.chart.hasLoinc")}
              color="var(--info)"
              onClick={() => setLoincFilter(loincFilter === true ? null : true)}
            />
            <Pill
              active={loincFilter === false}
              label={t("standardPros.chart.noLoinc")}
              color="var(--text-ghost)"
              onClick={() => setLoincFilter(loincFilter === false ? null : false)}
            />
          </div>

          <span className="text-text-disabled">|</span>

          {/* SNOMED */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-ghost uppercase tracking-wider">{t("standardPros.instrumentDetail.snomed")}</span>
            <Pill
              active={snomedFilter === true}
              label={t("standardPros.chart.hasSnomed")}
              color="var(--warning)"
              onClick={() => setSnomedFilter(snomedFilter === true ? null : true)}
            />
            <Pill
              active={snomedFilter === false}
              label={t("standardPros.chart.noSnomed")}
              color="var(--text-ghost)"
              onClick={() => setSnomedFilter(snomedFilter === false ? null : false)}
            />
          </div>

          <span className="text-text-disabled">|</span>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-text-ghost" />
            <span className="text-[10px] text-text-ghost uppercase tracking-wider">{t("standardPros.common.sort")}</span>
            {sortOptions.map((opt) => (
              <button
                key={opt.field}
                type="button"
                onClick={() => handleSort(opt.field)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                  sortField === opt.field
                    ? "bg-accent/15 text-accent"
                    : "bg-surface-overlay text-text-muted hover:text-text-secondary hover:bg-surface-elevated",
                )}
              >
                {opt.label}
                {sortField === opt.field && (
                  <span className="ml-0.5">
                    {sortDir === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <>
              <span className="text-text-disabled">|</span>
              <button
                type="button"
                onClick={() => {
                  setDomainFilter(null);
                  setOmopFilter(null);
                  setLicenseFilter(null);
                  setLoincFilter(null);
                  setSnomedFilter(null);
                }}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium text-critical hover:bg-critical/10 transition-colors"
              >
                {t("standardPros.table.clearFilters", { count: activeFilterCount })}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Results count ──────────────────────────────────────────────── */}
      <p className="text-xs text-text-ghost">
        {t("standardPros.table.showing")}{" "}
        <span className="font-['IBM_Plex_Mono',monospace] text-text-secondary">
          {filtered.length}
        </span>{" "}
        {t("standardPros.table.of")} {instruments.length} {t("standardPros.common.instruments").toLowerCase()}
      </p>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border-default">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default bg-surface-base">
                {(
                  [
                    ["abbreviation", t("standardPros.common.abbreviation")],
                    ["name", t("standardPros.table.instrumentName")],
                    ["domain", t("standardPros.common.domain")],
                    ["items", t("standardPros.common.items")],
                    ["omopCoverage", t("standardPros.common.omop")],
                    ["license", t("standardPros.common.license")],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <th
                    key={field}
                    className="px-3 py-2.5 text-left text-text-muted font-medium cursor-pointer hover:text-text-primary transition-colors select-none"
                    onClick={() => handleSort(field)}
                    >
                    <div className="flex items-center gap-1">
                      {label}
                      {renderSortIcon(field)}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-text-muted font-medium">
                  {t("standardPros.instrumentDetail.loinc")}
                </th>
                <th className="px-3 py-2.5 text-left text-text-muted font-medium">
                  {t("standardPros.instrumentDetail.snomed")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inst) => (
                <tr
                  key={inst.abbreviation}
                  className={cn(
                    "border-b border-border-default/50 last:border-b-0 hover:bg-surface-overlay transition-colors",
                    inst.id && "cursor-pointer",
                  )}
                  onClick={() => {
                    if (inst.id) navigate(`/standard-pros/${inst.id}`);
                  }}
                >
                  <td className="px-3 py-2.5 font-semibold text-text-primary whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {inst.abbreviation}
                      {inst.id && (
                        <ChevronRight size={12} className="text-text-ghost" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary max-w-[300px]">
                    {inst.name}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className="inline-block rounded-md px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${DOMAIN_COLORS[inst.domain] ?? "var(--text-ghost)"}15`,
                        color: DOMAIN_COLORS[inst.domain] ?? "var(--text-ghost)",
                      }}
                    >
                      {standardProsCatalogDomainLabel(t, inst.domain)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-['IBM_Plex_Mono',monospace] text-text-muted text-center">
                    {inst.items}
                  </td>
                  <td className="px-3 py-2.5">
                    <OmopBadge coverage={inst.omopCoverage} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        inst.license === "public"
                          ? "text-success"
                          : "text-accent",
                      )}
                    >
                      {standardProsLicenseLabel(t, inst.license)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <LoincBadge hasLoinc={inst.hasLoinc} code={inst.loincCode} />
                  </td>
                  <td className="px-3 py-2.5">
                    {inst.hasSnomed ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                        <Check size={10} />
                        {inst.snomedCode ?? t("standardPros.common.yes")}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-ghost">{"\u2014"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-sm text-text-ghost"
                  >
                    {t("standardPros.table.noMatches")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
