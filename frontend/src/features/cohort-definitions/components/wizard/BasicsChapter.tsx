import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { X } from "lucide-react";
import { useState } from "react";

const DOMAIN_OPTIONS = [
  { value: "cardiovascular", label: "Cardiovascular" },
  { value: "metabolic", label: "Metabolic / Endocrine" },
  { value: "renal", label: "Renal" },
  { value: "oncology", label: "Oncology" },
  { value: "rare-disease", label: "Rare Disease" },
  { value: "pain-substance-use", label: "Pain / Substance Use" },
  { value: "pediatric", label: "Pediatric" },
  { value: "general", label: "General" },
] as const;

export function BasicsChapter() {
  const { name, description, domain, tags, setName, setDescription, setDomain, setTags } =
    useCohortWizardStore();
  const [tagInput, setTagInput] = useState("");

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
          Cohort Name <span className="text-critical">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Type 2 Diabetes on Metformin"
          autoFocus
          className="w-full rounded-lg border border-border-default bg-surface-base px-4 py-2.5 text-[14px] text-text-secondary placeholder-[#555] outline-none transition-colors focus:border-accent"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          Description <span className="text-[11px] text-text-ghost">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the clinical context and purpose of this cohort..."
          rows={3}
          className="w-full resize-none rounded-lg border border-border-default bg-surface-base px-4 py-2.5 text-[13px] text-text-secondary placeholder-[#555] outline-none transition-colors focus:border-accent"
        />
      </div>

      {/* Domain */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          Clinical Domain
        </label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full rounded-lg border border-border-default bg-surface-base px-4 py-2.5 text-[13px] text-text-secondary outline-none transition-colors focus:border-accent"
        >
          <option value="">Select a domain...</option>
          {DOMAIN_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          Tags <span className="text-[11px] text-text-ghost">(optional)</span>
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
            placeholder="Add tag..."
            className="rounded-md border border-border-default bg-surface-base px-3 py-1 text-[12px] text-text-secondary placeholder-[#555] outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Validation hint */}
      {!name && (
        <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
          <span className="text-[13px] text-text-muted">
            <strong className="text-accent">Required:</strong> Enter a name for your cohort to continue.
          </span>
        </div>
      )}
    </div>
  );
}
