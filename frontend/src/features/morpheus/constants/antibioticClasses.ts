// frontend/src/features/morpheus/constants/antibioticClasses.ts

export interface AntibioticClass {
  id: string;
  order: number;
}

const CLASS_MAP: Record<string, AntibioticClass> = {
  // Penicillins
  'ampicillin': { id: 'penicillins', order: 1 },
  'ampicillin/sulbactam': { id: 'penicillins', order: 1 },
  'piperacillin/tazobactam': { id: 'penicillins', order: 1 },
  'oxacillin': { id: 'penicillins', order: 1 },
  'penicillin g': { id: 'penicillins', order: 1 },
  'penicillin': { id: 'penicillins', order: 1 },
  // Cephalosporins
  'cefazolin': { id: 'cephalosporins', order: 2 },
  'ceftriaxone': { id: 'cephalosporins', order: 2 },
  'ceftazidime': { id: 'cephalosporins', order: 2 },
  'cefepime': { id: 'cephalosporins', order: 2 },
  'cefoxitin': { id: 'cephalosporins', order: 2 },
  // Carbapenems
  'meropenem': { id: 'carbapenems', order: 3 },
  'imipenem': { id: 'carbapenems', order: 3 },
  'ertapenem': { id: 'carbapenems', order: 3 },
  'doripenem': { id: 'carbapenems', order: 3 },
  // Fluoroquinolones
  'ciprofloxacin': { id: 'fluoroquinolones', order: 4 },
  'levofloxacin': { id: 'fluoroquinolones', order: 4 },
  'moxifloxacin': { id: 'fluoroquinolones', order: 4 },
  // Aminoglycosides
  'gentamicin': { id: 'aminoglycosides', order: 5 },
  'tobramycin': { id: 'aminoglycosides', order: 5 },
  'amikacin': { id: 'aminoglycosides', order: 5 },
  // Glycopeptides
  'vancomycin': { id: 'glycopeptides', order: 6 },
  // Macrolides
  'erythromycin': { id: 'macrolides', order: 7 },
  'azithromycin': { id: 'macrolides', order: 7 },
  // Lincosamides
  'clindamycin': { id: 'lincosamides', order: 7 },
  // Tetracyclines
  'tetracycline': { id: 'tetracyclines', order: 8 },
  'doxycycline': { id: 'tetracyclines', order: 8 },
  // Sulfonamides
  'trimethoprim/sulfa': { id: 'sulfonamides', order: 9 },
  'trimethoprim/sulfamethoxazole': { id: 'sulfonamides', order: 9 },
  // Other
  'nitrofurantoin': { id: 'other', order: 10 },
  'linezolid': { id: 'other', order: 10 },
  'daptomycin': { id: 'other', order: 10 },
  'colistin': { id: 'other', order: 10 },
  'metronidazole': { id: 'other', order: 10 },
  'rifampin': { id: 'other', order: 10 },
};

export function getAntibioticClass(name: string): AntibioticClass {
  return CLASS_MAP[name.toLowerCase()] ?? { id: 'other', order: 10 };
}

export function sortAntibioticsByClass(antibiotics: string[]): string[] {
  return [...antibiotics].sort((a, b) => {
    const classA = getAntibioticClass(a);
    const classB = getAntibioticClass(b);
    if (classA.order !== classB.order) return classA.order - classB.order;
    return a.localeCompare(b);
  });
}
