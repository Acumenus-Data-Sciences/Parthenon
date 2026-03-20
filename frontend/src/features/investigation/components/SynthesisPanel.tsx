import type { Investigation, PinSection } from "../types";
import { useEvidencePins, useDeletePin } from "../hooks/useEvidencePins";
import { PinCard } from "./PinCard";

interface SynthesisPanelProps {
  investigation: Investigation;
}

interface DossierSection {
  key: PinSection | "research_question";
  label: string;
}

const DOSSIER_SECTIONS: DossierSection[] = [
  { key: "research_question", label: "Research Question" },
  { key: "phenotype_definition", label: "Phenotype Definition" },
  { key: "population", label: "Population Characteristics" },
  { key: "clinical_evidence", label: "Clinical Evidence" },
  { key: "genomic_evidence", label: "Genomic Evidence" },
  { key: "synthesis", label: "Evidence Synthesis" },
  { key: "limitations", label: "Limitations & Caveats" },
  { key: "methods", label: "Methods" },
];

export function SynthesisPanel({ investigation }: SynthesisPanelProps) {
  const { data: pins = [] } = useEvidencePins(investigation.id);
  const deletePin = useDeletePin(investigation.id);

  const pinsBySection = pins.reduce<Record<string, typeof pins>>(
    (acc, pin) => {
      const key = pin.section;
      if (!acc[key]) acc[key] = [];
      acc[key].push(pin);
      return acc;
    },
    {},
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-base font-semibold text-zinc-100 mb-4">
        Evidence Dossier
      </h2>
      <div className="flex flex-col gap-3">
        {DOSSIER_SECTIONS.map((section) => {
          const sectionPins =
            section.key === "research_question"
              ? []
              : (pinsBySection[section.key] ?? []);
          const pinCount = sectionPins.length;

          return (
            <div
              key={section.key}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4"
            >
              {/* Section header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-zinc-200">
                  {section.label}
                </span>
                {section.key !== "research_question" && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-medium ${
                      pinCount > 0
                        ? "bg-teal-900 text-teal-300"
                        : "bg-zinc-700 text-zinc-400"
                    }`}
                  >
                    {pinCount}
                  </span>
                )}
              </div>

              {/* Section content */}
              {section.key === "research_question" ? (
                investigation.research_question ? (
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {investigation.research_question}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500 italic">
                    No research question defined
                  </p>
                )
              ) : sectionPins.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {sectionPins.map((pin) => (
                    <PinCard
                      key={pin.id}
                      pin={pin}
                      onDelete={(id) => deletePin.mutate(id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">No findings pinned yet</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
