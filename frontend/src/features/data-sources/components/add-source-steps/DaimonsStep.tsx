import { Database, BookOpen, BarChart2, Clock } from "lucide-react";

export interface DaimonsData {
  cdm: string;
  vocabulary: string;
  results: string;
  temp: string;
}

interface Props {
  data: DaimonsData;
  onChange: (data: DaimonsData) => void;
}

const DAIMON_ROWS = [
  {
    key: "cdm" as const,
    label: "CDM",
    icon: Database,
    placeholder: "omop",
    required: true,
    description: "Clinical data — person, condition_occurrence, drug_exposure, etc.",
  },
  {
    key: "vocabulary" as const,
    label: "Vocabulary",
    icon: BookOpen,
    placeholder: "omop",
    required: true,
    description: "OMOP vocabularies — concept, concept_ancestor, vocabulary, domain, etc.",
  },
  {
    key: "results" as const,
    label: "Results",
    icon: BarChart2,
    placeholder: "achilles_results",
    required: true,
    description: "Achilles characterization results and cohort counts.",
  },
  {
    key: "temp" as const,
    label: "Temp",
    icon: Clock,
    placeholder: "temp",
    required: false,
    description: "Temporary schema for cohort generation (optional — leave empty to skip).",
  },
];

export function DaimonsStep({ data, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#F0EDE8]">Schema Qualifiers (Daimons)</h2>
        <p className="mt-1 text-sm text-[#8A857D]">
          Each daimon tells Parthenon which PostgreSQL schema holds that type of data.
        </p>
      </div>

      <div className="space-y-3">
        {DAIMON_ROWS.map(({ key, label, icon: Icon, placeholder, required, description }) => (
          <div key={key} className="rounded-lg border border-[#232328] bg-[#0E0E11] px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#232328] bg-[#151518]">
                <Icon size={13} className="text-[#8A857D]" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-[#C5C0B8]">{label}</span>
                  {required ? (
                    <span className="text-[#E85A6B] text-xs">*</span>
                  ) : (
                    <span className="rounded-full bg-[#232328] px-1.5 py-0.5 text-[9px] font-medium text-[#5A5650]">
                      Optional
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5A5650]">{description}</p>
                <input
                  type="text"
                  value={data[key]}
                  onChange={(e) => onChange({ ...data, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full rounded-md border border-[#232328] bg-[#151518] px-3 py-1.5 font-mono text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:border-[#C9A227] focus:outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
