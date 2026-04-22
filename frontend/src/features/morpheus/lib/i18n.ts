import type { TFunction } from 'i18next';

const GENDER_KEY_MAP: Record<string, string> = {
  M: 'male',
  F: 'female',
};

const EVENT_DOMAIN_KEY_MAP: Record<string, string> = {
  admissions: 'admissions',
  icu_stays: 'icuStays',
  transfers: 'transfers',
  diagnoses: 'diagnoses',
  procedures: 'procedures',
  prescriptions: 'medications',
  lab_results: 'labs',
  vitals: 'vitals',
  input_events: 'inputs',
  output_events: 'outputs',
  microbiology: 'micro',
};

const VITAL_LABEL_KEY_MAP: Record<string, string> = {
  heart_rate: 'heartRate',
  blood_pressure_systolic: 'bloodPressureSystolic',
  blood_pressure_diastolic: 'bloodPressureDiastolic',
  blood_pressure_mean: 'bloodPressureMean',
  spo2: 'spo2',
  respiratory_rate: 'respiratoryRate',
  temperature: 'temperature',
  gcs: 'gcs',
  pain: 'pain',
};

const LAB_PANEL_KEY_MAP: Record<string, string> = {
  renal: 'renal',
  hepatic: 'hepatic',
  hematologic: 'hematologic',
  metabolic: 'metabolic',
  coagulation: 'coagulation',
  cardiac: 'cardiac',
  inflammatory: 'inflammatory',
  other: 'other',
};

const ANTIBIOTIC_CLASS_KEY_MAP: Record<string, string> = {
  penicillins: 'penicillins',
  cephalosporins: 'cephalosporins',
  carbapenems: 'carbapenems',
  fluoroquinolones: 'fluoroquinolones',
  aminoglycosides: 'aminoglycosides',
  glycopeptides: 'glycopeptides',
  macrolides: 'macrolides',
  lincosamides: 'lincosamides',
  tetracyclines: 'tetracyclines',
  sulfonamides: 'sulfonamides',
  other: 'other',
};

const INTERPRETATION_KEY_MAP: Record<string, string> = {
  S: 'susceptible',
  I: 'intermediate',
  R: 'resistant',
};

export function getMorpheusGenderLabel(t: TFunction, gender: string): string {
  const key = GENDER_KEY_MAP[gender];
  if (!key) return gender;
  return t(`morpheus.common.gender.${key}`);
}

export function getMorpheusEventDomainLabel(t: TFunction, domain: string): string {
  const key = EVENT_DOMAIN_KEY_MAP[domain];
  if (!key) return domain;
  return t(`morpheus.eventCounts.${key}`);
}

export function getMorpheusVitalLabel(t: TFunction, category: string): string {
  const key = VITAL_LABEL_KEY_MAP[category];
  if (!key) return category;
  return t(`morpheus.vitals.labels.${key}`);
}

export function getMorpheusLabPanelLabel(t: TFunction, panelId: string): string {
  const key = LAB_PANEL_KEY_MAP[panelId];
  if (!key) return panelId;
  return t(`morpheus.labs.panels.${key}`);
}

export function getMorpheusAntibioticClassLabel(
  t: TFunction,
  classId: string,
): string {
  const key = ANTIBIOTIC_CLASS_KEY_MAP[classId];
  if (!key) return classId;
  return t(`morpheus.antibiogram.classes.${key}`);
}

export function getMorpheusInterpretationLabel(
  t: TFunction,
  interpretation: string,
): string {
  const key = INTERPRETATION_KEY_MAP[interpretation];
  if (!key) return interpretation;
  return t(`morpheus.antibiogram.interpretation.${key}`);
}
