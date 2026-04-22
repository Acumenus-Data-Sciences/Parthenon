// frontend/src/features/morpheus/constants/labPanels.ts

export interface LabPanelConfig {
  id: string;
  color: string;
  tests: string[]; // Match against MorpheusLabResult.label (case-insensitive)
}

export const LAB_PANELS: LabPanelConfig[] = [
  {
    id: 'renal',
    color: '#3B82F6',
    tests: [
      'creatinine', 'urea nitrogen', 'potassium', 'sodium', 'chloride',
      'bicarbonate', 'calcium, total', 'phosphate', 'magnesium',
    ],
  },
  {
    id: 'hepatic',
    color: '#F59E0B',
    tests: [
      'alanine aminotransferase', 'asparate aminotransferase',
      'alkaline phosphatase', 'bilirubin, total', 'bilirubin, direct',
      'albumin', 'total protein',
    ],
  },
  {
    id: 'hematologic',
    color: '#E85A6B',
    tests: [
      'white blood cells', 'hemoglobin', 'hematocrit', 'platelet count',
      'red blood cells', 'mcv', 'mch', 'mchc', 'rdw',
    ],
  },
  {
    id: 'metabolic',
    color: '#22C55E',
    tests: [
      'glucose', 'lactate', 'anion gap',
    ],
  },
  {
    id: 'coagulation',
    color: '#A855F7',
    tests: [
      'pt', 'inr(pt)', 'ptt', 'fibrinogen', 'd-dimer',
    ],
  },
  {
    id: 'cardiac',
    color: '#EC4899',
    tests: [
      'troponin t', 'troponin i', 'ck (cpk)', 'ck-mb', 'ldh',
      'ntprobnp', 'bnp',
    ],
  },
  {
    id: 'inflammatory',
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
