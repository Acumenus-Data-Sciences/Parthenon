import type {
  StudyDesignAsset,
  StudyDesignLockReadiness,
  StudyDesignManifestPreview,
  StudyDesignVersion,
} from "../../../types/study";
import {
  recordValue,
  textValue,
} from "../../workbench/studyDesignWorkbenchHelpers";

// Pure data helpers for LockLaunchpad + PackageReceipt — provenance fields
// and manifest tree derivation. Kept separate from lockHelpers.ts (which
// owns preflight derivation) so each file stays under the 500-LOC budget.

export interface ProvenanceFields {
  protocolFile: string;
  protocolPages: string;
  protocolImportedAt: string;
  vocabularyVersion: string;
  hadesVersion: string;
  sitesBound: string;
  signingKeyHint: string;
}

export interface ManifestNode {
  /** Indent level for ASCII tree. */
  depth: number;
  /** Label including any tree-drawing prefix. */
  label: string;
  /** Optional mono suffix rendered right-aligned. */
  meta?: string;
}

// ----------------------------------------------------------------------
// Provenance derivation
// ----------------------------------------------------------------------

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function deriveVocabularySnapshot(version: StudyDesignVersion | null): string {
  if (!version) return "vocab default";
  const spec = recordValue(version.spec_json) ?? recordValue(version.normalized_spec_json);
  const candidate = textValue(spec?.vocabularySnapshot) ?? textValue(spec?.vocabulary_snapshot);
  if (candidate) return candidate;
  const provenance = recordValue(version.provenance_json);
  const provCandidate = textValue(provenance?.vocabulary_version) ?? textValue(provenance?.vocab_version);
  if (provCandidate) return provCandidate;
  return "vocab default";
}

function deriveHadesVersion(assets: ReadonlyArray<StudyDesignAsset>): string {
  for (const asset of assets) {
    if (asset.asset_type !== "analysis_plan") continue;
    const payload = recordValue(asset.draft_payload_json);
    if (!payload) continue;
    const capability = recordValue(payload.hades_capability);
    if (!capability) continue;
    const version = textValue(capability.version);
    if (version) return `HADES ${version}`;
  }
  return "HADES 6.x";
}

function deriveProtocolFields(
  version: StudyDesignVersion | null,
): { file: string; pages: string; importedAt: string } {
  if (!version) {
    return { file: "manual entry", pages: "—", importedAt: "—" };
  }
  const provenance = recordValue(version.provenance_json);
  const protocol = recordValue(provenance?.protocol_import) ?? recordValue(provenance?.protocol);
  const fileName = textValue(protocol?.file_name)
    ?? textValue(protocol?.filename)
    ?? textValue(provenance?.source);
  const pageCount = protocol?.page_count ?? protocol?.pages;
  const importedAt = textValue(protocol?.imported_at)
    ?? textValue(provenance?.imported_at);
  return {
    file: fileName ?? "manual entry",
    pages: typeof pageCount === "number" ? `${pageCount} pages` : "—",
    importedAt: importedAt ? fmtDate(importedAt) : fmtDate(version.created_at),
  };
}

function signingKeyHint(version: StudyDesignVersion | null): string {
  if (!version) return "0x————…";
  // Stable presentational stand-in until a real signing service lands.
  const hex = version.id.toString(16).padStart(4, "0").toUpperCase().slice(0, 4);
  return `0x${hex}…`;
}

export function buildProvenanceFields(
  version: StudyDesignVersion | null,
  assets: ReadonlyArray<StudyDesignAsset>,
  readiness: StudyDesignLockReadiness | null,
): ProvenanceFields {
  const protocol = deriveProtocolFields(version);
  // Cross-check with readiness.provenance_summary
  const summary = readiness?.provenance_summary;
  if (summary?.accepted_at && protocol.importedAt === "—") {
    protocol.importedAt = fmtDate(summary.accepted_at);
  }
  return {
    protocolFile: protocol.file,
    protocolPages: protocol.pages,
    protocolImportedAt: protocol.importedAt,
    vocabularyVersion: deriveVocabularySnapshot(version),
    hadesVersion: deriveHadesVersion(assets),
    sitesBound: "Acumenus OHDSI",
    signingKeyHint: signingKeyHint(version),
  };
}

// ----------------------------------------------------------------------
// Manifest tree
// ----------------------------------------------------------------------

export function buildManifestNodes(
  version: StudyDesignVersion | null,
  manifest: StudyDesignManifestPreview | null,
  assets: ReadonlyArray<StudyDesignAsset>,
): ReadonlyArray<ManifestNode> {
  const contents = manifest?.contents ?? null;
  const acceptedCount =
    typeof contents?.accepted_recommendations === "number"
      ? contents.accepted_recommendations
      : assets.filter((a) => a.asset_type === "phenotype_recommendation" && a.reviewed_at != null).length;
  const conceptCount =
    typeof contents?.concept_sets === "number"
      ? contents.concept_sets
      : assets.filter((a) => a.asset_type === "concept_set_draft" && a.materialized_id != null).length;
  const cohortCount =
    typeof contents?.cohorts === "number"
      ? contents.cohorts
      : assets.filter((a) => a.asset_type === "cohort_draft" && a.canonical_id != null).length;
  const analysisCount =
    typeof contents?.analysis_plans === "number"
      ? contents.analysis_plans
      : assets.filter((a) => a.asset_type === "analysis_plan" && a.materialized_id != null).length;
  const studyDir = `study-${version?.session_id ?? "session"}-v${version?.version_number ?? "1"}`;
  return [
    { depth: 0, label: `${studyDir}/`, meta: "ROOT" },
    { depth: 1, label: "├─ manifest.json", meta: "schema v1" },
    { depth: 1, label: "├─ intent.json", meta: "PICO" },
    { depth: 1, label: "├─ cohorts/", meta: `${cohortCount} linked` },
    { depth: 1, label: "├─ concept-sets/", meta: `${conceptCount} sets` },
    { depth: 1, label: "├─ phenotypes/", meta: `${acceptedCount} accepted` },
    { depth: 1, label: "├─ feasibility.json", meta: "report" },
    { depth: 1, label: "├─ analyses/", meta: `${analysisCount} plans` },
    { depth: 1, label: "└─ provenance.json", meta: "signed" },
  ];
}
