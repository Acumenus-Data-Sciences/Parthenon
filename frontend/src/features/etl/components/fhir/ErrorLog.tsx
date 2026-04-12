import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  XCircle,
  Search,
  X,
} from "lucide-react";
import { FHIR_RESOURCE_ICONS } from "../../lib/fhir-utils";
import type { FhirIngestResult } from "../../api/fhirApi";

export function ErrorLog({ errors }: { errors: FhirIngestResult["errors"] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (errors.length === 0) return null;

  const filtered = search
    ? errors.filter(
        (e) =>
          e.resource_type.toLowerCase().includes(search.toLowerCase()) ||
          e.message.toLowerCase().includes(search.toLowerCase()),
      )
    : errors;

  // Group by resource type
  const grouped = new Map<string, typeof errors>();
  for (const err of filtered) {
    const arr = grouped.get(err.resource_type) ?? [];
    arr.push(err);
    grouped.set(err.resource_type, arr);
  }

  return (
    <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <AlertTriangle size={14} className="shrink-0 text-[#E85A6B]" />
        <span className="flex-1 text-sm font-medium text-[#E85A6B]">
          {errors.length} resource{errors.length !== 1 ? "s" : ""} failed
        </span>
        {open ? (
          <ChevronDown size={14} className="text-[#E85A6B]" />
        ) : (
          <ChevronRight size={14} className="text-[#E85A6B]" />
        )}
      </button>

      {open && (
        <div className="border-t border-[#E85A6B]/20">
          {/* Search within errors */}
          {errors.length > 5 && (
            <div className="px-4 py-2 border-b border-[#E85A6B]/10">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5650]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter errors..."
                  className="w-full rounded bg-[#0E0E11] border border-[#E85A6B]/20 pl-7 pr-7 py-1.5 text-xs text-[#C5C0B8] placeholder:text-[#5A5650] outline-none focus:border-[#E85A6B]/40"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="px-4 py-3 space-y-3 max-h-[300px] overflow-y-auto">
            {Array.from(grouped.entries()).map(([type, errs]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[#E85A6B]">
                    {FHIR_RESOURCE_ICONS[type] ?? "\u{1F4C4}"} {type}
                  </span>
                  <span className="text-[10px] text-[#8A857D]">
                    ({errs.length} error{errs.length !== 1 ? "s" : ""})
                  </span>
                </div>
                {errs.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs ml-4 mb-1"
                  >
                    <XCircle size={10} className="mt-0.5 shrink-0 text-[#E85A6B]/60" />
                    <span className="text-[#C5C0B8] leading-relaxed">
                      {err.message}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {filtered.length === 0 && search && (
              <p className="text-xs text-[#8A857D] text-center py-2">
                No errors matching &quot;{search}&quot;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
