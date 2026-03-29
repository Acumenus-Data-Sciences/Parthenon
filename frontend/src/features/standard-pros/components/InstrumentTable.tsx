import { useState, useMemo } from "react";
import {
  Search,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Minus,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProInstrument, OmopCoverage } from "../types/proInstrument";
import { DOMAIN_COLORS, OMOP_COLORS } from "../types/proInstrument";

interface InstrumentTableProps {
  instruments: ProInstrument[];
}

type SortField = "abbreviation" | "name" | "domain" | "items" | "omopCoverage" | "license";
type SortDir = "asc" | "desc";

function OmopBadge({ coverage }: { coverage: OmopCoverage }) {
  const label =
    coverage === "yes" ? "Full" : coverage === "partial" ? "Partial" : "None";
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
  if (!hasLoinc) {
    return (
      <span className="text-[10px] text-[#5A5650]">\u2014</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#2DD4BF]/10 px-2 py-0.5 text-[10px] font-medium text-[#2DD4BF]">
      <Check size={10} />
      {code ?? "Yes"}
    </span>
  );
}

export function InstrumentTable({ instruments }: InstrumentTableProps) {
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [omopFilter, setOmopFilter] = useState<OmopCoverage | null>(null);
  const [licenseFilter, setLicenseFilter] = useState<"public" | "proprietary" | null>(null);
  const [loincFilter, setLoincFilter] = useState<boolean | null>(null);
  const [sortField, setSortField] = useState<SortField>("domain");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(false);

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const inst of instruments) set.add(inst.domain);
    return [...set].sort();
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

    const sorted = [...list].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [instruments, search, domainFilter, omopFilter, licenseFilter, loincFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <span className="w-3" />;
    return sortDir === "asc" ? (
      <ChevronUp size={12} className="text-[#C9A227]" />
    ) : (
      <ChevronDown size={12} className="text-[#C9A227]" />
    );
  };

  const activeFilterCount =
    (domainFilter ? 1 : 0) +
    (omopFilter ? 1 : 0) +
    (licenseFilter ? 1 : 0) +
    (loincFilter !== null ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search + filter toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <input
            type="text"
            placeholder="Search instruments by name, abbreviation, or domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] py-2 pl-9 pr-3 text-sm text-[#F0EDE8] placeholder-[#5A5650] outline-none focus:border-[#C9A227]/40 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
            showFilters || activeFilterCount > 0
              ? "border-[#C9A227]/40 bg-[#C9A227]/5 text-[#C9A227]"
              : "border-[#2A2A2F] bg-[#141418] text-[#8A857D] hover:text-[#F0EDE8]",
          )}
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[#C9A227] w-4 h-4 text-[10px] font-bold text-[#0E0E11]">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-[#2A2A2F] bg-[#141418] p-4">
          {/* Domain filter */}
          <div>
            <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
              Domain
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDomainFilter(null)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                  !domainFilter
                    ? "bg-[#C9A227]/15 text-[#C9A227]"
                    : "bg-[#1A1A1F] text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                All
              </button>
              {domains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setDomainFilter(domainFilter === d ? null : d)
                  }
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                    domainFilter === d
                      ? "text-[#0E0E11]"
                      : "bg-[#1A1A1F] text-[#8A857D] hover:text-[#C5C0B8]",
                  )}
                  style={
                    domainFilter === d
                      ? { backgroundColor: DOMAIN_COLORS[d] ?? "#5A5650" }
                      : undefined
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* OMOP filter */}
          <div>
            <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
              OMOP Coverage
            </p>
            <div className="flex gap-1.5">
              {(["yes", "partial", "no"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setOmopFilter(omopFilter === v ? null : v)
                  }
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                    omopFilter === v
                      ? "text-[#0E0E11]"
                      : "bg-[#1A1A1F] text-[#8A857D] hover:text-[#C5C0B8]",
                  )}
                  style={
                    omopFilter === v
                      ? { backgroundColor: OMOP_COLORS[v] }
                      : undefined
                  }
                >
                  {v === "yes" ? "Full" : v === "partial" ? "Partial" : "None"}
                </button>
              ))}
            </div>
          </div>

          {/* License filter */}
          <div>
            <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
              License
            </p>
            <div className="flex gap-1.5">
              {(["public", "proprietary"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setLicenseFilter(licenseFilter === v ? null : v)
                  }
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                    licenseFilter === v
                      ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                      : "bg-[#1A1A1F] text-[#8A857D] hover:text-[#C5C0B8]",
                  )}
                >
                  {v === "public" ? "Public Domain" : "Proprietary"}
                </button>
              ))}
            </div>
          </div>

          {/* LOINC filter */}
          <div>
            <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
              LOINC Code
            </p>
            <div className="flex gap-1.5">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() =>
                    setLoincFilter(loincFilter === v ? null : v)
                  }
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                    loincFilter === v
                      ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                      : "bg-[#1A1A1F] text-[#8A857D] hover:text-[#C5C0B8]",
                  )}
                >
                  {v ? "Has LOINC" : "No LOINC"}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setDomainFilter(null);
                setOmopFilter(null);
                setLicenseFilter(null);
                setLoincFilter(null);
              }}
              className="self-end rounded-md px-2 py-1 text-[10px] font-medium text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-[#5A5650]">
        Showing{" "}
        <span className="font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
          {filtered.length}
        </span>{" "}
        of {instruments.length} instruments
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#2A2A2F]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2F] bg-[#0E0E11]">
                {(
                  [
                    ["abbreviation", "Abbrev."],
                    ["name", "Instrument Name"],
                    ["domain", "Domain"],
                    ["items", "Items"],
                    ["omopCoverage", "OMOP"],
                    ["license", "License"],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <th
                    key={field}
                    className="px-3 py-2.5 text-left text-[#8A857D] font-medium cursor-pointer hover:text-[#F0EDE8] transition-colors select-none"
                    onClick={() => handleSort(field)}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon field={field} />
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-[#8A857D] font-medium">
                  LOINC
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inst) => (
                <tr
                  key={inst.abbreviation}
                  className="border-b border-[#2A2A2F]/50 last:border-b-0 hover:bg-[#1A1A1F] transition-colors"
                >
                  <td className="px-3 py-2.5 font-semibold text-[#F0EDE8] whitespace-nowrap">
                    {inst.abbreviation}
                  </td>
                  <td className="px-3 py-2.5 text-[#C5C0B8] max-w-[300px]">
                    {inst.name}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className="inline-block rounded-md px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${DOMAIN_COLORS[inst.domain] ?? "#5A5650"}15`,
                        color: DOMAIN_COLORS[inst.domain] ?? "#5A5650",
                      }}
                    >
                      {inst.domain}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-['IBM_Plex_Mono',monospace] text-[#8A857D] text-center">
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
                          ? "text-[#2DD4BF]"
                          : "text-[#C9A227]",
                      )}
                    >
                      {inst.license === "public" ? "Public" : "Proprietary"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <LoincBadge
                      hasLoinc={inst.hasLoinc}
                      code={inst.loincCode}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-sm text-[#5A5650]"
                  >
                    No instruments match your filters.
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
