import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function BasicsChapter() {
  const { t } = useTranslation("app");
  const { name, description, domain, tags, setName, setDescription, setDomain, setTags } =
    useCohortWizardStore();
  const [tagInput, setTagInput] = useState("");
  const domainOptions = [
    {
      value: "cardiovascular",
      label: t("cohortDefinitions.auto.cardiovascular_59ea4b"),
    },
    {
      value: "metabolic",
      label: t("cohortDefinitions.auto.metabolicEndocrine_4d43ef"),
    },
    { value: "renal", label: t("cohortDefinitions.auto.renal_199d35") },
    { value: "oncology", label: t("cohortDefinitions.auto.oncology_50b74a") },
    {
      value: "rare-disease",
      label: t("cohortDefinitions.auto.rareDisease_f7ba34"),
    },
    {
      value: "pain-substance-use",
      label: t("cohortDefinitions.auto.painSubstanceUse_1b8b0d"),
    },
    {
      value: "pediatric",
      label: t("cohortDefinitions.auto.pediatric_c66795"),
    },
    { value: "general", label: t("cohortDefinitions.auto.general_0db377") },
  ] as const;

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.cohortName_fbe06f")} <span className="text-critical">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("cohortDefinitions.auto.eGType2DiabetesOnMetformin_23126f")}
          autoFocus
          className="w-full rounded-lg border border-border-default bg-surface-base px-4 py-2.5 text-[14px] text-text-secondary placeholder:text-text-ghost outline-none transition-colors focus:border-accent"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.description_b5a7ad")} <span className="text-[11px] text-text-ghost">{t("cohortDefinitions.auto.optional_f53d1c")}</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("cohortDefinitions.auto.describeTheClinicalContextAndPurposeOfThis_ae81cf")}
          rows={3}
          className="w-full resize-none rounded-lg border border-border-default bg-surface-base px-4 py-2.5 text-[13px] text-text-secondary placeholder:text-text-ghost outline-none transition-colors focus:border-accent"
        />
      </div>

      {/* Domain */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.clinicalDomain_357e2f")}
        </label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full rounded-lg border border-border-default bg-surface-base px-4 py-2.5 text-[13px] text-text-secondary outline-none transition-colors focus:border-accent"
        >
          <option value="">{t("cohortDefinitions.auto.selectADomain_d010f3")}</option>
          {domainOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.tags_189f63")} <span className="text-[11px] text-text-ghost">{t("cohortDefinitions.auto.optional_f53d1c")}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-md border border-border-default bg-surface-overlay px-2.5 py-1 text-[12px] text-text-secondary"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-text-ghost hover:text-critical"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={handleAddTag}
            placeholder={t("cohortDefinitions.auto.addTag_f34097")}
            className="rounded-md border border-border-default bg-surface-base px-3 py-1 text-[12px] text-text-secondary placeholder:text-text-ghost outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Validation hint */}
      {!name && (
        <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
          <span className="text-[13px] text-text-muted">
            <strong className="text-accent">{t("cohortDefinitions.auto.required_22eab7")}</strong> {t("cohortDefinitions.auto.enterANameForYourCohortToContinue_204c40")}
          </span>
        </div>
      )}
    </div>
  );
}
