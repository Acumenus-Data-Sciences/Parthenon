import { Dna, ScanLine, SkipForward } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { GenomicCriteriaPanel } from "@/features/genomics/components/GenomicCriteriaPanel";
import { ImagingCriteriaPanel } from "@/features/imaging/components/ImagingCriteriaPanel";
import { useTranslation } from "react-i18next";

export function SpecializedChapter() {
  const { t } = useTranslation("app");
  const {
    selectedSpecialized,
    setSelectedSpecialized,
    genomicCriteria,
    imagingCriteria,
    addGenomicCriterion,
    removeGenomicCriterion,
    addImagingCriterion,
    removeImagingCriterion,
    goNext,
  } = useCohortWizardStore();

  const toggleSpecialized = (type: "genomic" | "imaging") => {
    if (selectedSpecialized.includes(type)) {
      setSelectedSpecialized(selectedSpecialized.filter((s) => s !== type));
    } else {
      setSelectedSpecialized([...selectedSpecialized, type]);
    }
  };

  const hasSelected = selectedSpecialized.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.specializedCriteria_965942")}{" "}
          <span className="text-[11px] text-text-ghost">{t("cohortDefinitions.auto.optional_f53d1c")}</span>
        </div>
        <p className="text-[13px] text-text-muted">
          {t("cohortDefinitions.auto.doYouNeedAnySpecializedCriteriaForThis_361b81")}
        </p>
      </div>

      {/* Opt-in cards */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => toggleSpecialized("genomic")}
          className={`rounded-lg p-4 text-center transition-colors ${
            selectedSpecialized.includes("genomic")
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-border-default bg-surface-overlay hover:border-surface-highlight"
          }`}
        >
          <Dna size={24} className="mx-auto mb-1.5 text-domain-observation" />
          <div className="text-[13px] font-medium text-text-secondary">{t("cohortDefinitions.auto.genomic_bf62ca")}</div>
          <div className="mt-1 text-[11px] text-text-ghost">{t("cohortDefinitions.auto.geneMutationsTmbMsiFusions_cd9be4")}</div>
        </button>

        <button
          type="button"
          onClick={() => toggleSpecialized("imaging")}
          className={`rounded-lg p-4 text-center transition-colors ${
            selectedSpecialized.includes("imaging")
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-border-default bg-surface-overlay hover:border-surface-highlight"
          }`}
        >
          <ScanLine size={24} className="mx-auto mb-1.5 text-info" />
          <div className="text-[13px] font-medium text-text-secondary">{t("cohortDefinitions.auto.imaging_92c65a")}</div>
          <div className="mt-1 text-[11px] text-text-ghost">{t("cohortDefinitions.auto.modalityAnatomyAiClassification_9a3aae")}</div>
        </button>

        <button
          type="button"
          onClick={goNext}
          className="rounded-lg border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] p-4 text-center transition-colors hover:border-[rgba(45,212,191,0.3)]"
        >
          <SkipForward size={24} className="mx-auto mb-1.5 text-success" />
          <div className="text-[13px] font-medium text-success">{t("cohortDefinitions.auto.skip_72ef2b")}</div>
          <div className="mt-1 text-[11px] text-text-ghost">{t("cohortDefinitions.auto.noSpecializedCriteriaNeeded_2e6136")}</div>
        </button>
      </div>

      {/* Genomic panel */}
      {selectedSpecialized.includes("genomic") && (
        <div className="rounded-lg border border-border-default bg-surface-base p-4">
          <h4 className="mb-3 text-[13px] font-medium text-domain-observation">{t("cohortDefinitions.auto.genomicCriteria_b8b854")}</h4>
          {genomicCriteria.map((gc, i) => (
            <div
              key={gc._key ?? `gc-${i}`}
              className="mb-2 flex items-center justify-between rounded-md border border-border-default bg-surface-overlay px-3 py-2"
            >
              <span className="text-[12px] text-text-secondary">{gc.label}</span>
              <button
                type="button"
                onClick={() => removeGenomicCriterion(i)}
                className="text-text-disabled hover:text-critical"
              >
                {t("cohortDefinitions.auto.text_144607")}
              </button>
            </div>
          ))}
          <GenomicCriteriaPanel
            onAdd={addGenomicCriterion}
            onCancel={() => setSelectedSpecialized(selectedSpecialized.filter((s) => s !== "genomic"))}
          />
        </div>
      )}

      {/* Imaging panel */}
      {selectedSpecialized.includes("imaging") && (
        <div className="rounded-lg border border-border-default bg-surface-base p-4">
          <h4 className="mb-3 text-[13px] font-medium text-info">{t("cohortDefinitions.auto.imagingCriteria_983710")}</h4>
          {imagingCriteria.map((ic, i) => (
            <div
              key={ic._key ?? `ic-${i}`}
              className="mb-2 flex items-center justify-between rounded-md border border-border-default bg-surface-overlay px-3 py-2"
            >
              <span className="text-[12px] text-text-secondary">{ic.label}</span>
              <button
                type="button"
                onClick={() => removeImagingCriterion(i)}
                className="text-text-disabled hover:text-critical"
              >
                {t("cohortDefinitions.auto.text_144607")}
              </button>
            </div>
          ))}
          <ImagingCriteriaPanel
            onAdd={addImagingCriterion}
            onCancel={() => setSelectedSpecialized(selectedSpecialized.filter((s) => s !== "imaging"))}
          />
        </div>
      )}

      {/* Data availability warning */}
      {hasSelected && (
        <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
          <span className="text-accent">{t("cohortDefinitions.auto.text_22968d")}</span>{" "}
          <span className="text-[11px] text-text-muted">
            {t("cohortDefinitions.auto.theseCriteriaRequireSpecializedDataInYourCdm_6554de")}
          </span>
        </div>
      )}
    </div>
  );
}
