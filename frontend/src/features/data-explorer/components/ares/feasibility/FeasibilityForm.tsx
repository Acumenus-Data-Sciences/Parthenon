import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeasibilityCriteria } from "../../../types/ares";
import TemplateSelector from "./TemplateSelector";

const DOMAINS = [
  "condition",
  "drug",
  "procedure",
  "measurement",
  "observation",
  "visit",
];

interface FeasibilityFormProps {
  onSubmit: (name: string, criteria: FeasibilityCriteria) => void;
  isLoading: boolean;
}

export default function FeasibilityForm({ onSubmit, isLoading }: FeasibilityFormProps) {
  const { t } = useTranslation("app");
  const [name, setName] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [minPatients, setMinPatients] = useState<string>("");

  const toggleDomain = (domainId: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domainId) ? prev.filter((d) => d !== domainId) : [...prev, domainId],
    );
  };

  const handleTemplateSelect = (criteria: FeasibilityCriteria, templateName: string) => {
    setName(templateName);
    setSelectedDomains(criteria.required_domains ?? []);
    if (criteria.min_patients) {
      setMinPatients(String(criteria.min_patients));
    } else {
      setMinPatients("");
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || selectedDomains.length === 0) return;

    const criteria: FeasibilityCriteria = {
      required_domains: selectedDomains,
    };

    if (minPatients && parseInt(minPatients) > 0) {
      criteria.min_patients = parseInt(minPatients);
    }

    onSubmit(name, criteria);
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-overlay p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">
        {t("dataExplorer.ares.feasibility.form.title")}
      </h3>

      <TemplateSelector onSelect={handleTemplateSelect} />

      <div className="mb-3">
        <label className="mb-1 block text-xs text-text-muted">
          {t("dataExplorer.ares.feasibility.form.assessmentName")}
        </label>
        <input
          type="text"
          placeholder={t("dataExplorer.ares.feasibility.form.assessmentNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary
                     placeholder:text-text-ghost focus:border-accent focus:outline-none"
        />
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-text-muted">
          {t("dataExplorer.ares.feasibility.form.requiredDomains")}
        </label>
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => toggleDomain(domain)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedDomains.includes(domain)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border-default text-text-muted hover:border-surface-highlight"
              }`}
            >
              {t(`dataExplorer.ares.feasibility.form.domains.${domain}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-text-muted">
          {t("dataExplorer.ares.feasibility.form.minPatientCount")}
        </label>
        <input
          type="number"
          placeholder={t("dataExplorer.ares.feasibility.form.minPatientCountPlaceholder")}
          value={minPatients}
          onChange={(e) => setMinPatients(e.target.value)}
          className="w-48 rounded border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary
                     placeholder:text-text-ghost focus:border-accent focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || selectedDomains.length === 0 || isLoading}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-black
                   hover:bg-accent disabled:opacity-50"
      >
        {isLoading
          ? t("dataExplorer.ares.feasibility.actions.running")
          : t("dataExplorer.ares.feasibility.actions.runAssessment")}
      </button>
    </div>
  );
}
