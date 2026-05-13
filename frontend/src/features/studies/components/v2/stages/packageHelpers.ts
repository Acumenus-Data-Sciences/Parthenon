import type {
  StudyDesignLockReadiness,
  StudyDesignVersion,
} from "../../../types/study";
import {
  isRecord,
  recordValue,
  textValue,
} from "../../workbench/studyDesignWorkbenchHelpers";
import type { ManifestNode, ProvenanceFields } from "./lockHelpers";

// Phase 5 helpers split out from lockHelpers.ts to keep each file under the
// 500-line project budget. Owns:
//   * Package signing-stub derivation (`buildPackageSummary`)
//   * Manifest → JSON string serialization (`manifestToJsonString`)
//   * Version-list / diff helpers used by VersionTimeline (`buildDiffRows`,
//     `toneFromStatus`, `relativeTimeFromNow`)

// ----------------------------------------------------------------------
// Package summary
// ----------------------------------------------------------------------

export interface PackageSummary {
  signedAtIso: string | null;
  signedAtLabel: string;
  sizeLabel: string;
  fullHashHex: string;
  downloadUrl: string | null;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function fullHashHex(version: StudyDesignVersion | null, readiness: StudyDesignLockReadiness | null): string {
  const sha = readiness?.provenance_summary?.package_manifest_sha256;
  if (typeof sha === "string" && sha.length > 0) return sha.startsWith("0x") ? sha : `0x${sha}`;
  if (!version) return "0x————————————————";
  // Stable mock hash derived from version id — strictly presentational.
  const hex = version.id.toString(16).padStart(8, "0");
  return `0x${hex}${hex.repeat(7).slice(0, 56)}`;
}

export function buildPackageSummary(
  version: StudyDesignVersion | null,
  readiness: StudyDesignLockReadiness | null,
): PackageSummary {
  const artifact = readiness?.package_artifact ?? null;
  const signedIso = artifact?.created_at ?? version?.locked_at ?? null;
  const signedLabel = signedIso ? fmtDate(signedIso) : "—";
  const sizeLabel = formatBytes(artifact?.file_size_bytes ?? null);
  return {
    signedAtIso: signedIso,
    signedAtLabel: signedLabel,
    sizeLabel,
    fullHashHex: fullHashHex(version, readiness),
    downloadUrl: artifact?.url ?? null,
  };
}

export function manifestToJsonString(
  nodes: ReadonlyArray<ManifestNode>,
  provenance: ProvenanceFields,
): string {
  const json = {
    manifest: nodes.map((node) => ({ label: node.label, meta: node.meta ?? null })),
    provenance: {
      protocol_file: provenance.protocolFile,
      protocol_pages: provenance.protocolPages,
      protocol_imported_at: provenance.protocolImportedAt,
      vocabulary_version: provenance.vocabularyVersion,
      hades_version: provenance.hadesVersion,
      sites_bound: provenance.sitesBound,
      signing_key: provenance.signingKeyHint,
    },
  };
  return JSON.stringify(json, null, 2);
}

// ----------------------------------------------------------------------
// Diff helpers for VersionTimeline
// ----------------------------------------------------------------------

const PICO_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "research_question", label: "Research question" },
  { key: "primary_objective", label: "Primary objective" },
  { key: "population", label: "Population" },
  { key: "exposure", label: "Exposure" },
  { key: "comparator", label: "Comparator" },
  { key: "outcome", label: "Primary outcome" },
];

function readPicoValue(version: StudyDesignVersion | null, key: string): string {
  if (!version) return "";
  const spec = recordValue(version.normalized_spec_json) ?? recordValue(version.spec_json);
  if (!spec) return "";
  const direct = spec[key];
  if (typeof direct === "string") return direct;
  const intent = recordValue(spec.intent);
  if (intent && typeof intent[key] === "string") return intent[key] as string;
  const pico = recordValue(spec.pico);
  if (pico && typeof pico[key] === "string") return pico[key] as string;
  if (isRecord(direct)) {
    const label = textValue(direct.label) ?? textValue(direct.name);
    if (label) return label;
  }
  return "";
}

export interface DiffRow {
  field: string;
  label: string;
  leftValue: string;
  rightValue: string;
  changed: boolean;
}

export function buildDiffRows(
  left: StudyDesignVersion | null,
  right: StudyDesignVersion | null,
): ReadonlyArray<DiffRow> {
  return PICO_FIELDS.map((spec) => {
    const leftValue = readPicoValue(left, spec.key);
    const rightValue = readPicoValue(right, spec.key);
    return {
      field: spec.key,
      label: spec.label,
      leftValue,
      rightValue,
      changed: leftValue !== rightValue,
    };
  });
}

// ----------------------------------------------------------------------
// Version-list helpers
// ----------------------------------------------------------------------

export type VersionTone = "teal" | "gold" | "slate";

export function toneFromStatus(status: string): VersionTone {
  const s = status.toLowerCase();
  if (s === "accepted" || s === "locked") return "teal";
  if (s === "review" || s === "needs_review" || s === "needs-review") return "gold";
  return "slate";
}

export function relativeTimeFromNow(iso: string | null | undefined): string {
  if (!iso) return "—";
  const when = new Date(iso).getTime();
  if (Number.isNaN(when)) return "—";
  const diffMs = Date.now() - when;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
