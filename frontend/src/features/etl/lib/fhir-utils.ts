// ──────────────────────────────────────────────────────────────────────────────
// FHIR ingestion utility helpers
// ──────────────────────────────────────────────────────────────────────────────

import type { FhirIngestResult } from "../api/fhirApi";

// ── Constants ────────────────────────────────────────────────────────────────

export const HISTORY_KEY = "parthenon:fhir-ingestion:history";
export const MAX_HISTORY = 30;

export const CDM_TABLE_ORDER = [
  "person",
  "visit_occurrence",
  "condition_occurrence",
  "drug_exposure",
  "procedure_occurrence",
  "measurement",
  "observation",
  "device_exposure",
  "specimen",
  "death",
  "note",
  "cost",
];

export const CDM_TABLE_COLORS: Record<string, string> = {
  person: "#2DD4BF",
  visit_occurrence: "#60A5FA",
  condition_occurrence: "#F472B6",
  drug_exposure: "#C9A227",
  procedure_occurrence: "#A78BFA",
  measurement: "#34D399",
  observation: "#FB923C",
  device_exposure: "#818CF8",
  specimen: "#F9A8D4",
  death: "#94A3B8",
  note: "#67E8F9",
  cost: "#FCD34D",
};

export const FHIR_RESOURCE_ICONS: Record<string, string> = {
  Patient: "\u{1F9D1}",
  Condition: "\u{1FA7A}",
  MedicationRequest: "\u{1F48A}",
  Procedure: "\u{1FA78}",
  Observation: "\u{1F52C}",
  Encounter: "\u{1F3E5}",
  DiagnosticReport: "\u{1F4CB}",
  Immunization: "\u{1F489}",
  AllergyIntolerance: "\u26A0\uFE0F",
  CarePlan: "\u{1F4DD}",
  Claim: "\u{1F4B5}",
  Device: "\u{1FA7C}",
};

export const EXAMPLE_BUNDLE = `{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "example-patient-1",
        "gender": "female",
        "birthDate": "1985-04-12",
        "name": [{ "family": "Smith", "given": ["Jane"] }]
      }
    },
    {
      "resource": {
        "resourceType": "Condition",
        "subject": { "reference": "Patient/example-patient-1" },
        "code": {
          "coding": [{ "system": "http://snomed.info/sct", "code": "73211009", "display": "Diabetes mellitus" }]
        },
        "onsetDateTime": "2020-03-15"
      }
    },
    {
      "resource": {
        "resourceType": "MedicationRequest",
        "subject": { "reference": "Patient/example-patient-1" },
        "medicationCodeableConcept": {
          "coding": [{ "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "860975" }]
        },
        "authoredOn": "2020-03-15"
      }
    }
  ]
}`;

// ── Types ────────────────────────────────────────────────────────────────────

export type InputMode = "json" | "file";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  inputMode: InputMode;
  fileName?: string;
  resourceCount: number;
  recordsCreated: number;
  errorCount: number;
  status: string;
  elapsedSeconds: number;
  resourceBreakdown: Record<string, number>;
  result: FhirIngestResult;
}

export interface ResourcePreview {
  resourceType: string;
  count: number;
  hasId: number;
  hasCoding: number;
}

// ── Utility functions ────────────────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function fmtNumber(n: number): string {
  return n.toLocaleString();
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export function analyzeBundle(raw: string): ResourcePreview[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    let resources: unknown[] = [];

    if (parsed.resourceType === "Bundle" && Array.isArray(parsed.entry)) {
      resources = parsed.entry
        .map((e: { resource?: unknown }) => e.resource)
        .filter(Boolean);
    } else if (parsed.resourceType) {
      resources = [parsed];
    }

    if (resources.length === 0) return null;

    const map = new Map<string, { count: number; hasId: number; hasCoding: number }>();

    for (const r of resources) {
      const res = r as Record<string, unknown>;
      const type = (res.resourceType as string) ?? "Unknown";
      const entry = map.get(type) ?? { count: 0, hasId: 0, hasCoding: 0 };
      entry.count++;
      if (res.id) entry.hasId++;
      // Check for any coded field
      const hasCode =
        res.code && typeof res.code === "object" && Array.isArray((res.code as { coding?: unknown[] }).coding);
      if (hasCode) entry.hasCoding++;
      map.set(type, entry);
    }

    return Array.from(map.entries())
      .map(([resourceType, stats]) => ({ resourceType, ...stats }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return null;
  }
}

export function analyzeNdjson(raw: string): ResourcePreview[] | null {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const map = new Map<string, { count: number; hasId: number; hasCoding: number }>();
  let validCount = 0;

  for (const line of lines) {
    try {
      const res = JSON.parse(line) as Record<string, unknown>;
      if (!res.resourceType) continue;
      validCount++;
      const type = res.resourceType as string;
      const entry = map.get(type) ?? { count: 0, hasId: 0, hasCoding: 0 };
      entry.count++;
      if (res.id) entry.hasId++;
      const hasCode =
        res.code && typeof res.code === "object" && Array.isArray((res.code as { coding?: unknown[] }).coding);
      if (hasCode) entry.hasCoding++;
      map.set(type, entry);
    } catch {
      // skip invalid lines
    }
  }

  if (validCount === 0) return null;

  return Array.from(map.entries())
    .map(([resourceType, stats]) => ({ resourceType, ...stats }))
    .sort((a, b) => b.count - a.count);
}

export function exportResultJson(result: FhirIngestResult): void {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fhir-ingest-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
