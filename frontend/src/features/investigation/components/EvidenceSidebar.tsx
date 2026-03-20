import { ChevronRight } from "lucide-react";
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
  const { data: pins } = useEvidencePins(investigationId);
  const deletePin = useDeletePin(investigationId);

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
        "flex flex-col border-l border-zinc-800 transition-all duration-200 overflow-hidden shrink-0",
        sidebarOpen ? "w-72" : "w-8",
      ].join(" ")}
      style={{ backgroundColor: "#0E0E11" }}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800">
        {sidebarOpen && (
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Evidence
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="text-zinc-500 hover:text-zinc-300 transition-colors ml-auto"
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
          {sections.length === 0 && (
            <p className="text-xs text-zinc-600 text-center mt-8">No pins yet</p>
          )}
          {sections.map((section) => {
            const sectionPins = grouped[section] ?? [];
            return (
              <div key={section}>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
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
