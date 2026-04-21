import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Investigation, PinSection, SynthesisState } from "../types";
import { useEvidencePins, useUpdatePin, useDeletePin } from "../hooks/useEvidencePins";
import { useAutoSave } from "../hooks/useAutoSave";
import { safeSynthesisState } from "../lib/safeState";
import { SectionEditor } from "./synthesis/SectionEditor";
import { ExportBar } from "./synthesis/ExportBar";
import { VersionHistory } from "./synthesis/VersionHistory";
import { getInvestigationSectionLabel } from "../lib/i18n";

interface SynthesisPanelProps {
  investigation: Investigation;
}

type SubTab = "dossier" | "export" | "versions";

export function SynthesisPanel({ investigation }: SynthesisPanelProps) {
  const { t } = useTranslation("app");
  const [activeTab, setActiveTab] = useState<SubTab>("dossier");

  // Pins
  const { data: pins = [] } = useEvidencePins(investigation.id);
  const updatePin = useUpdatePin(investigation.id);
  const deletePin = useDeletePin(investigation.id);

  // Synthesis state
  const [synthesisState, setSynthesisState] = useState<SynthesisState>(() =>
    safeSynthesisState(investigation.synthesis_state),
  );

  // Auto-save
  useAutoSave(investigation.id, "synthesis", synthesisState as unknown as Record<string, unknown>);

  const pinsBySection = pins.reduce<Record<string, typeof pins>>((acc, pin) => {
    const key = pin.section;
    if (!acc[key]) acc[key] = [];
    acc[key].push(pin);
    return acc;
  }, {});

  function handleNarrativeChange(sectionKey: string, text: string) {
    setSynthesisState((prev) => ({
      ...prev,
      section_narratives: {
        ...prev.section_narratives,
        [sectionKey]: text,
      },
    }));
  }

  function handleToggleKeyFinding(pinId: number, current: boolean) {
    updatePin.mutate({ pinId, payload: { is_key_finding: !current } });
  }

  function handleDeletePin(pinId: number) {
    deletePin.mutate(pinId);
  }

  function handleUpdatePinNarrative(
    pinId: number,
    field: "narrative_before" | "narrative_after",
    text: string,
  ) {
    updatePin.mutate({ pinId, payload: { [field]: text } });
  }

  const tabs: { id: SubTab; label: string }[] = [
    { id: "dossier", label: t("investigation.common.tabs.dossier") },
    { id: "export", label: t("investigation.common.tabs.export") },
    { id: "versions", label: t("investigation.common.tabs.versions") },
  ];

  const dossierSectionKeys: Array<PinSection | "research_question"> = [
    "research_question",
    "phenotype_definition",
    "population",
    "clinical_evidence",
    "genomic_evidence",
    "synthesis",
    "limitations",
    "methods",
  ];

  const dossierSections: Array<{
    key: PinSection | "research_question";
    label: string;
  }> = dossierSectionKeys.map((key) => ({
    key,
    label: getInvestigationSectionLabel(t, key),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-border-default">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-surface-raised text-text-primary"
                : "text-text-ghost hover:text-text-secondary hover:bg-surface-raised/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "dossier" && (
          <div className="p-6 max-w-3xl mx-auto">
            <h2 className="text-base font-semibold text-text-primary mb-4">
              {t("investigation.common.sections.evidenceDossier")}
            </h2>
            <div className="flex flex-col gap-3">
              {dossierSections.map((section) => {
                if (section.key === "research_question") {
                  return (
                    <div
                      key="research_question"
                      className="bg-surface-base/30 border border-border-default rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-text-primary">
                          {t("investigation.common.sections.researchQuestion")}
                        </span>
                      </div>
                      {investigation.research_question ? (
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {investigation.research_question}
                        </p>
                      ) : (
                        <p className="text-sm text-text-ghost italic">
                          {t("investigation.common.empty.noResearchQuestionDefined")}
                        </p>
                      )}
                    </div>
                  );
                }

                const sectionPins = pinsBySection[section.key] ?? [];
                const narrative = synthesisState.section_narratives[section.key] ?? null;

                return (
                  <SectionEditor
                    key={section.key}
                    sectionKey={section.key}
                    sectionLabel={section.label}
                    pins={sectionPins}
                    narrative={narrative}
                    onNarrativeChange={handleNarrativeChange}
                    onToggleKeyFinding={handleToggleKeyFinding}
                    onDeletePin={handleDeletePin}
                    onUpdatePinNarrative={handleUpdatePinNarrative}
                  />
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "export" && (
          <ExportBar
            investigationId={investigation.id}
            investigationTitle={investigation.title}
          />
        )}

        {activeTab === "versions" && (
          <VersionHistory
            investigationId={investigation.id}
            investigationStatus={investigation.status}
          />
        )}
      </div>
    </div>
  );
}
