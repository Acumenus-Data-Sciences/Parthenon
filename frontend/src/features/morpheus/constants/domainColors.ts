// frontend/src/features/morpheus/constants/domainColors.ts

export const DOMAIN_COLORS = {
  condition: '#E85A6B',
  diagnosis: '#E85A6B',
  drug: '#2DD4BF',
  medication: '#2DD4BF',
  procedure: '#C9A227',
  measurement: '#818CF8',
  lab: '#818CF8',
  observation: '#94A3B8',
  vital: '#94A3B8',
  visit: '#F59E0B',
  admission: '#F59E0B',
  microbiology: '#F472B6',
} as const;

export type ClinicalDomain = keyof typeof DOMAIN_COLORS;

export const DOMAIN_LABELS: Record<string, string> = {
  condition: 'Condition',
  diagnosis: 'Diagnosis',
  drug: 'Drug',
  medication: 'Medication',
  procedure: 'Procedure',
  measurement: 'Measurement',
  lab: 'Lab',
  observation: 'Observation',
  vital: 'Vital',
  visit: 'Visit',
  admission: 'Admission',
  microbiology: 'Microbiology',
};

/** Vital-specific colors for the bedside monitor grid (override domain-level slate) */
export const VITAL_COLORS = {
  heart_rate: '#22C55E',
  blood_pressure: '#E85A6B',
  spo2: '#2DD4BF',
  respiratory_rate: '#C9A227',
  temperature: '#818CF8',
  gcs: '#94A3B8',
} as const;
