import { useState } from "react";
import type { FeasibilityCriteria } from "../../../types/ares";
import TemplateSelector from "./TemplateSelector";

const DOMAINS = [
  { id: "condition", label: "Conditions" },
  { id: "drug", label: "Drugs" },
  { id: "procedure", label: "Procedures" },
  { id: "measurement", label: "Measurements" },
  { id: "observation", label: "Observations" },
  { id: "visit", label: "Visits" },
];

interface FeasibilityFormProps {
  onSubmit: (name: string, criteria: FeasibilityCriteria) => void;
  isLoading: boolean;
}

export default function FeasibilityForm({ onSubmit, isLoading }: FeasibilityFormProps) {
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
    <div className="rounded-lg border border-[#333] bg-[#1a1a22] p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">New Feasibility Assessment</h3>

      <TemplateSelector onSelect={handleTemplateSelect} />

      <div className="mb-3">
        <label className="mb-1 block text-xs text-[#888]">Assessment Name</label>
        <input
          type="text"
          placeholder="e.g. Diabetes Outcomes Study"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-[#333] bg-[#151518] px-3 py-2 text-sm text-text-primary
                     placeholder-[#555] focus:border-[#C9A227] focus:outline-none"
        />
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-[#888]">Required Domains</label>
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleDomain(d.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedDomains.includes(d.id)
                  ? "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]"
                  : "border-[#333] text-[#888] hover:border-[#555]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-[#888]">Minimum Patient Count (optional)</label>
        <input
          type="number"
          placeholder="e.g. 1000"
          value={minPatients}
          onChange={(e) => setMinPatients(e.target.value)}
          className="w-48 rounded border border-[#333] bg-[#151518] px-3 py-2 text-sm text-text-primary
                     placeholder-[#555] focus:border-[#C9A227] focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || selectedDomains.length === 0 || isLoading}
        className="rounded bg-[#C9A227] px-4 py-2 text-sm font-medium text-black
                   hover:bg-[#d4ad2f] disabled:opacity-50"
      >
        {isLoading ? "Running..." : "Run Assessment"}
      </button>
    </div>
  );
}
