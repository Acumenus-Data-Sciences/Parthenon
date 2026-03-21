// frontend/src/features/morpheus/constants/vitalTypes.ts

export type VitalCategory = 'heart_rate' | 'blood_pressure_systolic' | 'blood_pressure_diastolic'
  | 'blood_pressure_mean' | 'spo2' | 'respiratory_rate' | 'temperature' | 'gcs' | 'pain';

export interface VitalTypeConfig {
  category: VitalCategory;
  label: string;
  unit: string;
  normalRange: [number, number];
  criticalRange: [number, number];
}

/**
 * Map MIMIC-IV chartevents labels to vital categories.
 * MorpheusVital uses `label` field from d_items, not raw itemid.
 */
export const VITAL_LABEL_MAP: Record<string, VitalCategory> = {
  'heart rate': 'heart_rate',
  'respiratory rate': 'respiratory_rate',
  'o2 saturation pulseoxymetry': 'spo2',
  'spo2': 'spo2',
  'non invasive blood pressure systolic': 'blood_pressure_systolic',
  'arterial blood pressure systolic': 'blood_pressure_systolic',
  'non invasive blood pressure diastolic': 'blood_pressure_diastolic',
  'arterial blood pressure diastolic': 'blood_pressure_diastolic',
  'non invasive blood pressure mean': 'blood_pressure_mean',
  'arterial blood pressure mean': 'blood_pressure_mean',
  'temperature fahrenheit': 'temperature',
  'temperature celsius': 'temperature',
  'gcs - verbal response': 'gcs',
  'gcs - motor response': 'gcs',
  'gcs - eye opening': 'gcs',
  'gcs total': 'gcs',
  'pain level': 'pain',
  'pain level (rest)': 'pain',
};

export const VITAL_TYPE_CONFIGS: Record<string, VitalTypeConfig> = {
  heart_rate: { category: 'heart_rate', label: 'Heart Rate', unit: 'bpm', normalRange: [60, 100], criticalRange: [40, 150] },
  blood_pressure_systolic: { category: 'blood_pressure_systolic', label: 'BP Systolic', unit: 'mmHg', normalRange: [90, 140], criticalRange: [70, 180] },
  blood_pressure_diastolic: { category: 'blood_pressure_diastolic', label: 'BP Diastolic', unit: 'mmHg', normalRange: [60, 90], criticalRange: [40, 120] },
  blood_pressure_mean: { category: 'blood_pressure_mean', label: 'MAP', unit: 'mmHg', normalRange: [65, 110], criticalRange: [50, 130] },
  spo2: { category: 'spo2', label: 'SpO2', unit: '%', normalRange: [95, 100], criticalRange: [88, 100] },
  respiratory_rate: { category: 'respiratory_rate', label: 'Resp Rate', unit: '/min', normalRange: [12, 20], criticalRange: [8, 35] },
  temperature: { category: 'temperature', label: 'Temperature', unit: '\u00B0F', normalRange: [97.0, 99.5], criticalRange: [95.0, 104.0] },
  gcs: { category: 'gcs', label: 'GCS', unit: '', normalRange: [15, 15], criticalRange: [3, 15] },
  pain: { category: 'pain', label: 'Pain', unit: '/10', normalRange: [0, 3], criticalRange: [0, 10] },
};

export function classifyVital(label: string): VitalCategory | undefined {
  return VITAL_LABEL_MAP[label.toLowerCase()];
}
