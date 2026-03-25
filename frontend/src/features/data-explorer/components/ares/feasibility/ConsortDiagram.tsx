import type { FeasibilityResult } from "../../../types/ares";

interface ConsortDiagramProps {
  results: FeasibilityResult[];
  criteriaLabels: string[];
}

interface ConsortStep {
  label: string;
  remaining: number;
  excluded: number;
}

function buildConsortSteps(results: FeasibilityResult[], labels: string[]): ConsortStep[] {
  const total = results.length;
  const criterionKeys: Array<keyof Pick<FeasibilityResult, "domain_pass" | "concept_pass" | "visit_pass" | "date_pass" | "patient_pass">> = [
    "domain_pass",
    "concept_pass",
    "visit_pass",
    "date_pass",
    "patient_pass",
  ];

  const steps: ConsortStep[] = [{ label: "All Sources", remaining: total, excluded: 0 }];

  let currentSources = [...results];

  for (let i = 0; i < criterionKeys.length; i++) {
    const key = criterionKeys[i];
    const label = labels[i] ?? key;
    const failing = currentSources.filter((r) => !r[key]);
    const passing = currentSources.filter((r) => r[key]);

    steps.push({
      label,
      remaining: passing.length,
      excluded: failing.length,
    });

    currentSources = passing;
  }

  return steps;
}

export default function ConsortDiagram({ results, criteriaLabels }: ConsortDiagramProps) {
  if (results.length === 0) {
    return <p className="py-4 text-center text-xs text-[#555]">No results to display CONSORT diagram.</p>;
  }

  const defaultLabels = ["Domains", "Concepts", "Visit Types", "Date Range", "Patient Count"];
  const labels = criteriaLabels.length > 0 ? criteriaLabels : defaultLabels;
  const steps = buildConsortSteps(results, labels);

  return (
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
      <h4 className="mb-1 text-sm font-medium text-white">CONSORT-Style Attrition Flow</h4>
      <p className="mb-4 text-[11px] text-[#666]">
        Shows how sources are progressively excluded by each criterion gate.
      </p>

      <div className="flex flex-col items-center gap-0">
        {steps.map((step, idx) => (
          <div key={step.label} className="flex flex-col items-center">
            {/* Box */}
            <div
              className={`flex w-56 flex-col items-center rounded-lg border px-4 py-2 ${
                idx === 0
                  ? "border-[#C9A227]/40 bg-[#C9A227]/10"
                  : step.remaining === 0
                    ? "border-[#9B1B30]/40 bg-[#9B1B30]/10"
                    : "border-[#252530] bg-[#1a1a22]"
              }`}
            >
              <span className="text-[10px] text-[#888]">{step.label}</span>
              <span className="text-sm font-bold text-white">{step.remaining} sources</span>
            </div>

            {/* Arrow + exclusion label */}
            {idx < steps.length - 1 && (
              <div className="flex items-center gap-2 py-1">
                <div className="h-6 w-px bg-[#333]" />
                {steps[idx + 1].excluded > 0 && (
                  <span className="rounded bg-[#9B1B30]/15 px-2 py-0.5 text-[10px] text-[#e85d75]">
                    -{steps[idx + 1].excluded} excluded
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
