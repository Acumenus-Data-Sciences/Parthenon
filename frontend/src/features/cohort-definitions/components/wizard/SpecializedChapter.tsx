import { Dna, ScanLine, SkipForward } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { GenomicCriteriaPanel } from "@/features/genomics/components/GenomicCriteriaPanel";
import { ImagingCriteriaPanel } from "@/features/imaging/components/ImagingCriteriaPanel";

export function SpecializedChapter() {
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
          Specialized Criteria{" "}
          <span className="text-[11px] text-text-ghost">(optional)</span>
        </div>
        <p className="text-[13px] text-text-muted">
          Do you need any specialized criteria for this cohort?
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
          <div className="text-[13px] font-medium text-text-secondary">Genomic</div>
          <div className="mt-1 text-[11px] text-text-ghost">Gene mutations, TMB, MSI, fusions</div>
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
          <div className="text-[13px] font-medium text-text-secondary">Imaging</div>
          <div className="mt-1 text-[11px] text-text-ghost">Modality, anatomy, AI classification</div>
        </button>

        <button
          type="button"
          onClick={goNext}
          className="rounded-lg border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] p-4 text-center transition-colors hover:border-[rgba(45,212,191,0.3)]"
        >
          <SkipForward size={24} className="mx-auto mb-1.5 text-success" />
          <div className="text-[13px] font-medium text-success">Skip</div>
          <div className="mt-1 text-[11px] text-text-ghost">No specialized criteria needed</div>
        </button>
      </div>

      {/* Genomic panel */}
      {selectedSpecialized.includes("genomic") && (
        <div className="rounded-lg border border-border-default bg-surface-base p-4">
          <h4 className="mb-3 text-[13px] font-medium text-domain-observation">Genomic Criteria</h4>
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
                &#x2715;
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
          <h4 className="mb-3 text-[13px] font-medium text-info">Imaging Criteria</h4>
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
                &#x2715;
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
          <span className="text-accent">&#x1F4A1;</span>{" "}
          <span className="text-[11px] text-text-muted">
            These criteria require specialized data in your CDM (oncology extension tables, DICOM
            imaging series). If your data source doesn&apos;t have them, these filters will return
            zero patients.
          </span>
        </div>
      )}
    </div>
  );
}
