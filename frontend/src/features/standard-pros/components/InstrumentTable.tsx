import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

interface InstrumentTableProps {
  instruments: ProInstrument[];
}

type SortField = "abbreviation" | "name" | "domain" | "items" | "omopCoverage" | "license";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "domain", label: "Domain" },
  { field: "abbreviation", label: "Abbreviation" },
  { field: "name", label: "Name" },
  { field: "items", label: "Items" },
  { field: "omopCoverage", label: "OMOP" },
  { field: "license", label: "License" },
];

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
    return <span className="text-[10px] text-[#5A5650]">{"\u2014"}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#2DD4BF]/10 px-2 py-0.5 text-[10px] font-medium text-[#2DD4BF]">
      <Check size={10} />
      {code ?? "Yes"}
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
          ? "text-[#0E0E11]"
          : "bg-[#1A1A1F] text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#232328]",
      )}
      style={active ? { backgroundColor: color ?? "#C9A227" } : undefined}
    >
      {label}
    </button>
  );
}

export function InstrumentTable({ instruments }: InstrumentTableProps) {
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="w-3" />;
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
    (loincFilter !== null ? 1 : 0) +
    (snomedFilter !== null ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* ── Search bar ────────────────────────────────────────────────── */}
      <div className="relative">
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

      {/* ── Filter + Sort pills ───────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Domain pills */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#5A5650] uppercase tracking-wider shrink-0 w-14">
            Domain
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Pill
              active={!domainFilter}
              label="All"
              color="#C9A227"
              onClick={() => setDomainFilter(null)}
            />
            {domains.map(({ domain, count }) => (
              <Pill
                key={domain}
                active={domainFilter === domain}
                label={`${domain} (${count})`}
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
            <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">OMOP</span>
            {(["yes", "partial", "no"] as const).map((v) => (
              <Pill
                key={v}
                active={omopFilter === v}
                label={v === "yes" ? "Full" : v === "partial" ? "Partial" : "None"}
                color={OMOP_COLORS[v]}
                onClick={() => setOmopFilter(omopFilter === v ? null : v)}
              />
            ))}
          </div>

          <span className="text-[#2A2A2F]">|</span>

          {/* License */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">License</span>
            <Pill
              active={licenseFilter === "public"}
              label="Public"
              color="#2DD4BF"
              onClick={() => setLicenseFilter(licenseFilter === "public" ? null : "public")}
            />
            <Pill
              active={licenseFilter === "proprietary"}
              label="Proprietary"
              color="#C9A227"
              onClick={() => setLicenseFilter(licenseFilter === "proprietary" ? null : "proprietary")}
            />
          </div>

          <span className="text-[#2A2A2F]">|</span>

          {/* LOINC */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">LOINC</span>
            <Pill
              active={loincFilter === true}
              label="Has LOINC"
              color="#60A5FA"
              onClick={() => setLoincFilter(loincFilter === true ? null : true)}
            />
            <Pill
              active={loincFilter === false}
              label="No LOINC"
              color="#5A5650"
              onClick={() => setLoincFilter(loincFilter === false ? null : false)}
            />
          </div>

          <span className="text-[#2A2A2F]">|</span>

          {/* SNOMED */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">SNOMED</span>
            <Pill
              active={snomedFilter === true}
              label="Has SNOMED"
              color="#F59E0B"
              onClick={() => setSnomedFilter(snomedFilter === true ? null : true)}
            />
            <Pill
              active={snomedFilter === false}
              label="No SNOMED"
              color="#5A5650"
              onClick={() => setSnomedFilter(snomedFilter === false ? null : false)}
            />
          </div>

          <span className="text-[#2A2A2F]">|</span>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-[#5A5650]" />
            <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">Sort</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.field}
                type="button"
                onClick={() => handleSort(opt.field)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                  sortField === opt.field
                    ? "bg-[#C9A227]/15 text-[#C9A227]"
                    : "bg-[#1A1A1F] text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#232328]",
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
              <span className="text-[#2A2A2F]">|</span>
              <button
                type="button"
                onClick={() => {
                  setDomainFilter(null);
                  setOmopFilter(null);
                  setLicenseFilter(null);
                  setLoincFilter(null);
                  setSnomedFilter(null);
                }}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
              >
                Clear filters ({activeFilterCount})
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Results count ──────────────────────────────────────────────── */}
      <p className="text-xs text-[#5A5650]">
        Showing{" "}
        <span className="font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
          {filtered.length}
        </span>{" "}
        of {instruments.length} instruments
      </p>

      {/* ── Table ──────────────────────────────────────────────────────── */}
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
                <th className="px-3 py-2.5 text-left text-[#8A857D] font-medium">
                  SNOMED
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inst) => (
                <tr
                  key={inst.abbreviation}
                  className={cn(
                    "border-b border-[#2A2A2F]/50 last:border-b-0 hover:bg-[#1A1A1F] transition-colors",
                    inst.id && "cursor-pointer",
                  )}
                  onClick={() => {
                    if (inst.id) navigate(`/standard-pros/${inst.id}`);
                  }}
                >
                  <td className="px-3 py-2.5 font-semibold text-[#F0EDE8] whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {inst.abbreviation}
                      {inst.id && (
                        <ChevronRight size={12} className="text-[#5A5650]" />
                      )}
                    </div>
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
                    <LoincBadge hasLoinc={inst.hasLoinc} code={inst.loincCode} />
                  </td>
                  <td className="px-3 py-2.5">
                    {inst.hasSnomed ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-medium text-[#F59E0B]">
                        <Check size={10} />
                        {inst.snomedCode ?? "Yes"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#5A5650]">{"\u2014"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
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
