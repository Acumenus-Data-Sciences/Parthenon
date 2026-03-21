// frontend/src/features/morpheus/constants/antibioticClasses.ts

export interface AntibioticClass {
  name: string;
  order: number;
}

const CLASS_MAP: Record<string, AntibioticClass> = {
  // Penicillins
  'ampicillin': { name: 'Penicillins', order: 1 },
  'ampicillin/sulbactam': { name: 'Penicillins', order: 1 },
  'piperacillin/tazobactam': { name: 'Penicillins', order: 1 },
  'oxacillin': { name: 'Penicillins', order: 1 },
  'penicillin g': { name: 'Penicillins', order: 1 },
  'penicillin': { name: 'Penicillins', order: 1 },
  // Cephalosporins
  'cefazolin': { name: 'Cephalosporins', order: 2 },
  'ceftriaxone': { name: 'Cephalosporins', order: 2 },
  'ceftazidime': { name: 'Cephalosporins', order: 2 },
  'cefepime': { name: 'Cephalosporins', order: 2 },
  'cefoxitin': { name: 'Cephalosporins', order: 2 },
  // Carbapenems
  'meropenem': { name: 'Carbapenems', order: 3 },
  'imipenem': { name: 'Carbapenems', order: 3 },
  'ertapenem': { name: 'Carbapenems', order: 3 },
  'doripenem': { name: 'Carbapenems', order: 3 },
  // Fluoroquinolones
  'ciprofloxacin': { name: 'Fluoroquinolones', order: 4 },
  'levofloxacin': { name: 'Fluoroquinolones', order: 4 },
  'moxifloxacin': { name: 'Fluoroquinolones', order: 4 },
  // Aminoglycosides
  'gentamicin': { name: 'Aminoglycosides', order: 5 },
  'tobramycin': { name: 'Aminoglycosides', order: 5 },
  'amikacin': { name: 'Aminoglycosides', order: 5 },
  // Glycopeptides
  'vancomycin': { name: 'Glycopeptides', order: 6 },
  // Macrolides
  'erythromycin': { name: 'Macrolides', order: 7 },
  'azithromycin': { name: 'Macrolides', order: 7 },
  // Lincosamides
  'clindamycin': { name: 'Lincosamides', order: 7 },
  // Tetracyclines
  'tetracycline': { name: 'Tetracyclines', order: 8 },
  'doxycycline': { name: 'Tetracyclines', order: 8 },
  // Sulfonamides
  'trimethoprim/sulfa': { name: 'Sulfonamides', order: 9 },
  'trimethoprim/sulfamethoxazole': { name: 'Sulfonamides', order: 9 },
  // Other
  'nitrofurantoin': { name: 'Other', order: 10 },
  'linezolid': { name: 'Other', order: 10 },
  'daptomycin': { name: 'Other', order: 10 },
  'colistin': { name: 'Other', order: 10 },
  'metronidazole': { name: 'Other', order: 10 },
  'rifampin': { name: 'Other', order: 10 },
};

export function getAntibioticClass(name: string): AntibioticClass {
  return CLASS_MAP[name.toLowerCase()] ?? { name: 'Other', order: 10 };
}

export function sortAntibioticsByClass(antibiotics: string[]): string[] {
  return [...antibiotics].sort((a, b) => {
    const classA = getAntibioticClass(a);
    const classB = getAntibioticClass(b);
    if (classA.order !== classB.order) return classA.order - classB.order;
    return a.localeCompare(b);
  });
}
