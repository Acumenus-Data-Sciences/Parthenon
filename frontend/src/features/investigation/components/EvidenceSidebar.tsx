import { ChevronRight, Pin } from "lucide-react";
import { useDeletePin, useEvidencePins } from "../hooks/useEvidencePins";
import { useInvestigationStore } from "../stores/investigationStore";
import type { PinSection } from "../types";
import { PinCard } from "./PinCard";

interface EvidenceSidebarProps {
  investigationId: number;
}

const SECTION_LABELS: Record<PinSection, string> = {
  phenotype_definition: "Phenotype Definition",
  population: "Population",
  clinical_evidence: "Clinical Evidence",
  genomic_evidence: "Genomic Evidence",
  synthesis: "Synthesis",
  limitations: "Limitations",
  methods: "Methods",
};

export function EvidenceSidebar({ investigationId }: EvidenceSidebarProps) {
  const { sidebarOpen, toggleSidebar } = useInvestigationStore();
  const { data: pins, isLoading, isError, refetch } = useEvidencePins(investigationId);
  const deletePin = useDeletePin(investigationId);

  const pinCount = pins?.length ?? 0;

  // Group pins by section
  const grouped = (pins ?? []).reduce<Partial<Record<PinSection, typeof pins>>>(
    (acc, pin) => {
      const section = pin.section;
      if (!acc[section]) acc[section] = [];
      acc[section]!.push(pin);
      return acc;
    },
    {},
  );

  const sections = Object.keys(grouped) as PinSection[];

  return (
    <div
      className={[
        "flex flex-col border-l border-border-default transition-all duration-200 overflow-hidden shrink-0",
        sidebarOpen ? "w-72" : "w-8",
      ].join(" ")}
      style={{ backgroundColor: "#0E0E11" }}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-border-default">
        {sidebarOpen && (
          <span className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            Evidence
          </span>
        )}
        {/* Collapsed: show pin count badge when there are pins */}
        {!sidebarOpen && pinCount > 0 && (
          <div className="flex flex-col items-center gap-1 w-full mb-1">
            <Pin size={12} className="text-teal-400" />
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-900 text-teal-400 text-[10px] font-semibold">
              {pinCount > 99 ? "99+" : pinCount}
            </span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="text-text-ghost hover:text-text-secondary transition-colors ml-auto"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <ChevronRight
            size={16}
            className={`transition-transform ${sidebarOpen ? "rotate-0" : "rotate-180"}`}
          />
        </button>
      </div>

      {sidebarOpen && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col gap-3 mt-2" aria-label="Loading pins">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded bg-surface-raised/60 h-12 w-full" />
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center gap-2 mt-6 px-1">
              <p className="text-xs text-text-ghost text-center">Failed to load pins</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="text-xs text-[#2DD4BF] hover:underline transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && sections.length === 0 && (
            <p className="text-xs text-text-ghost text-center mt-8">No pins yet</p>
          )}

          {/* Pin sections */}
          {!isLoading && !isError && sections.map((section) => {
            const sectionPins = grouped[section] ?? [];
            return (
              <div key={section}>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-ghost mb-2">
                  {SECTION_LABELS[section] ?? section}
                </p>
                <div className="flex flex-col gap-1.5">
                  {sectionPins.map((pin) => (
                    <PinCard
                      key={pin.id}
                      pin={pin}
                      onDelete={(id) => deletePin.mutate(id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
