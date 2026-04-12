// frontend/src/features/morpheus/constants/labPanels.ts

export interface LabPanelConfig {
  name: string;
  color: string;
  tests: string[]; // Match against MorpheusLabResult.label (case-insensitive)
}

export const LAB_PANELS: LabPanelConfig[] = [
  {
    name: 'Renal',
    color: 'var(--info)',
    tests: [
      'creatinine', 'urea nitrogen', 'potassium', 'sodium', 'chloride',
      'bicarbonate', 'calcium, total', 'phosphate', 'magnesium',
    ],
  },
  {
    name: 'Hepatic',
    color: 'var(--warning)',
    tests: [
      'alanine aminotransferase', 'asparate aminotransferase',
      'alkaline phosphatase', 'bilirubin, total', 'bilirubin, direct',
      'albumin', 'total protein',
    ],
  },
  {
    name: 'Hematologic',
    color: "var(--critical)",
    tests: [
      'white blood cells', 'hemoglobin', 'hematocrit', 'platelet count',
      'red blood cells', 'mcv', 'mch', 'mchc', 'rdw',
    ],
  },
  {
    name: 'Metabolic',
    color: 'var(--success)',
    tests: [
      'glucose', 'lactate', 'anion gap',
    ],
  },
  {
    name: 'Coagulation',
    color: '#A855F7',
    tests: [
      'pt', 'inr(pt)', 'ptt', 'fibrinogen', 'd-dimer',
    ],
  },
  {
    name: 'Cardiac',
    color: '#EC4899',
    tests: [
      'troponin t', 'troponin i', 'ck (cpk)', 'ck-mb', 'ldh',
      'ntprobnp', 'bnp',
    ],
  },
  {
    name: 'Inflammatory',
    color: '#F97316',
    tests: [
      'c-reactive protein', 'procalcitonin', 'ferritin',
    ],
  },
];

/**
 * Map a lab label to its panel. Returns undefined if not in any panel.
 * Comparison is case-insensitive.
 */
export function findLabPanel(label: string): LabPanelConfig | undefined {
  const lower = label.toLowerCase();
  return LAB_PANELS.find((panel) => panel.tests.some((t) => lower.includes(t)));
}
