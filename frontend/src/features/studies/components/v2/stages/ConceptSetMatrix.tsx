import { useMemo } from "react";
import { CheckCircle2, ExternalLink, Hammer, Sparkles } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import type { StudyDesignAsset } from "../../../types/study";
import type { useStudyDesignWorkbench } from "../../../hooks/useStudyDesignWorkbench";
import {
  draftConceptArray,
  draftPayloadRecord,
  issueMessages,
  recordValue,
  textValue,
} from "../../workbench/studyDesignWorkbenchHelpers";
import { ActionGateHint } from "../../workbench/shared/ActionGateHint";
import { AssetMatrix, type AssetMatrixColumn, type AssetMatrixRowAction } from "./AssetMatrix";
import { PipelineGlyph, type PipelineGlyphState } from "../shared/PipelineGlyph";
import { ProvenanceDot, type ProvenanceSource } from "../shared/ProvenanceDot";

// Station 03 — Concept Sets. Configures AssetMatrix for the concept set
// draft → verify → materialize flow that v1 rendered as `ConceptSetDraftPanel`.
// Mirrors the v1 mutations 1-for-1.

type Workbench = ReturnType<typeof useStudyDesignWorkbench>;

export interface ConceptSetRow {
  id: number;
  asset: StudyDesignAsset;
  name: string;
  role: string;
  conceptCount: number;
  glyphState: PipelineGlyphState;
  glyphBlocked: boolean;
  provenance: { source: ProvenanceSource; hint: string } | null;
  blockerMessage: string | null;
  isVerified: boolean;
  isAccepted: boolean;
  isMaterialized: boolean;
  isLinked: boolean;
}

function deriveGlyphState(asset: StudyDesignAsset): PipelineGlyphState {
  if (asset.status === "linked") return "linked";
  if (asset.materialized_id != null || asset.status === "materialized") return "materialized";
  if (asset.verification_status === "verified" || asset.status === "accepted") return "verified";
  return "draft";
}

function provenanceForConceptSet(asset: StudyDesignAsset): { source: ProvenanceSource; hint: string } | null {
  const provenance = recordValue(asset.provenance_json);
  const rawSource = textValue(provenance?.source);
  if (rawSource) {
    const normalized = rawSource.toLowerCase();
    if (normalized.includes("ai") || normalized.includes("abby") || normalized.includes("llm")) {
      return { source: "ai", hint: rawSource };
    }
    if (normalized.includes("manual")) return { source: "manual", hint: rawSource };
    if (normalized.includes("import")) return { source: "imported", hint: rawSource };
    if (normalized.includes("protocol")) return { source: "protocol", hint: rawSource };
    return { source: "inferred", hint: rawSource };
  }
  return null;
}

function assetToRow(asset: StudyDesignAsset): ConceptSetRow {
  const payload = draftPayloadRecord(asset);
  const verification = recordValue(asset.verification_json);
  const concepts = draftConceptArray(verification?.concepts ?? payload.concepts);
  const blockers = issueMessages(verification?.blocking_reasons);
  const warnings = issueMessages(verification?.warnings);
  const isBlocked = asset.verification_status === "blocked";

  return {
    id: asset.id,
    asset,
    name: textValue(payload.title) || `Concept set draft #${asset.id}`,
    role: textValue(payload.role) || "—",
    conceptCount: concepts.length,
    glyphState: deriveGlyphState(asset),
    glyphBlocked: isBlocked,
    provenance: provenanceForConceptSet(asset),
    blockerMessage: blockers[0] ?? warnings[0] ?? null,
    isVerified: asset.verification_status === "verified",
    isAccepted: asset.status === "accepted",
    isMaterialized: asset.materialized_id != null || asset.status === "materialized",
    isLinked: asset.status === "linked",
  };
}

interface ConceptSetMatrixProps {
  workbench: Pick<
    Workbench,
    | "assets"
    | "selectedSession"
    | "selectedVersion"
    | "handleDraftConceptSets"
    | "handleVerifyConceptSetDraft"
    | "handleVerifyConceptSetDrafts"
    | "handleMaterializeConceptSetDraft"
    | "handleReviewAsset"
    | "draftConceptSets"
    | "verifyConceptSetDraft"
    | "verifyConceptSetDrafts"
    | "materializeConceptSetDraft"
    | "reviewAsset"
    | "assetsQuery"
  >;
}

const INPUT_ASSET_TYPES = [
  "phenotype_recommendation",
  "local_cohort",
  "local_concept_set",
];

export function ConceptSetMatrix({ workbench }: ConceptSetMatrixProps): JSX.Element {
  const {
    assets,
    selectedSession,
    selectedVersion,
    handleDraftConceptSets,
    handleVerifyConceptSetDraft,
    handleVerifyConceptSetDrafts,
    handleMaterializeConceptSetDraft,
    handleReviewAsset,
    draftConceptSets,
    verifyConceptSetDraft,
    verifyConceptSetDrafts,
    materializeConceptSetDraft,
    reviewAsset,
    assetsQuery,
  } = workbench;

  const rows = useMemo<ReadonlyArray<ConceptSetRow>>(() => {
    return assets
      .filter((asset) => asset.asset_type === "concept_set_draft")
      .sort((left, right) => right.id - left.id)
      .map(assetToRow);
  }, [assets]);

  const acceptedInputs = useMemo(
    () =>
      assets.filter(
        (asset) =>
          INPUT_ASSET_TYPES.includes(asset.asset_type) && asset.status === "accepted",
      ),
    [assets],
  );

  const materializedCount = rows.filter((row) => row.isMaterialized).length;

  const canDraft = selectedSession != null && selectedVersion != null && acceptedInputs.length > 0;
  const draftGate = !canDraft ? tAuto("studies.v2.conceptSets.acceptInputFirst") : null;

  const columns: ReadonlyArray<AssetMatrixColumn<ConceptSetRow>> = [
    {
      key: "name",
      label: tAuto("studies.v2.conceptSets.col.name"),
      width: "minmax(180px, 2fr)",
      render: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
    },
    {
      key: "role",
      label: tAuto("studies.v2.conceptSets.col.role"),
      width: "100px",
      render: (row) => <span className="text-text-muted">{row.role}</span>,
    },
    {
      key: "conceptCount",
      label: tAuto("studies.v2.conceptSets.col.count"),
      width: "100px",
      align: "right",
      render: (row) => <span className="tabular-nums text-text-secondary">{row.conceptCount}</span>,
    },
    {
      key: "glyph",
      label: tAuto("studies.v2.conceptSets.col.status"),
      width: "160px",
      render: (row) => (
        <PipelineGlyph state={row.glyphState} blocked={row.glyphBlocked} size="sm" />
      ),
    },
    {
      key: "provenance",
      label: tAuto("studies.v2.conceptSets.col.provenance"),
      width: "140px",
      render: (row) =>
        row.provenance ? (
          <ProvenanceDot source={row.provenance.source} hint={row.provenance.hint} />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ];

  const rowActions: ReadonlyArray<AssetMatrixRowAction<ConceptSetRow>> = [
    {
      id: "verify",
      label: tAuto("studies.v2.conceptSets.action.verify"),
      icon: CheckCircle2,
      tone: "teal",
      disabled: (row) =>
        row.isMaterialized ||
        row.asset.verification_status === "verified" ||
        verifyConceptSetDraft.isPending,
      onClick: (row) => handleVerifyConceptSetDraft(row.asset),
    },
    {
      id: "accept",
      label: tAuto("studies.v2.conceptSets.action.accept"),
      icon: CheckCircle2,
      tone: "gold",
      disabled: (row) =>
        row.isMaterialized ||
        row.isAccepted ||
        !row.isVerified ||
        reviewAsset.isPending,
      onClick: (row) => handleReviewAsset(row.asset, "accept", null),
    },
    {
      id: "materialize",
      label: tAuto("studies.v2.conceptSets.action.materialize"),
      icon: Hammer,
      tone: "teal",
      disabled: (row) =>
        row.isMaterialized ||
        !row.isAccepted ||
        !row.isVerified ||
        materializeConceptSetDraft.isPending,
      onClick: (row) => handleMaterializeConceptSetDraft(row.asset),
    },
    {
      id: "open",
      label: tAuto("studies.v2.conceptSets.action.open"),
      icon: ExternalLink,
      disabled: (row) => !row.isMaterialized,
      onClick: (row) => {
        if (row.asset.materialized_id != null) {
          window.open(`/concept-sets/${row.asset.materialized_id}`, "_blank", "noopener");
        }
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ActionGateHint message={draftGate} />
      <AssetMatrix<ConceptSetRow>
        stageLabel={tAuto("studies.v2.conceptSets.stageLabel")}
        title={
          tAuto("studies.v2.conceptSets.titleTemplate") +
          ` — ${rows.length} drafts, ${materializedCount} materialized`
        }
        columns={columns}
        rows={rows}
        rowActions={rowActions}
        headerActions={[
          {
            id: "verifyAll",
            label: tAuto("studies.v2.conceptSets.verifyAll"),
            icon: CheckCircle2,
            onClick: handleVerifyConceptSetDrafts,
            disabled: rows.length === 0 || verifyConceptSetDrafts.isPending,
          },
          {
            id: "draft",
            label: tAuto("studies.v2.conceptSets.draft"),
            icon: Sparkles,
            onClick: handleDraftConceptSets,
            disabled: !canDraft || draftConceptSets.isPending,
            title: draftGate ?? undefined,
          },
        ]}
        emptyState={{
          title: tAuto("studies.v2.conceptSets.empty.title"),
          description: tAuto("studies.v2.conceptSets.empty.description"),
          cta: {
            label: tAuto("studies.v2.conceptSets.empty.cta"),
            onClick: handleDraftConceptSets,
            disabled: !canDraft || draftConceptSets.isPending,
            title: draftGate ?? undefined,
          },
        }}
        isLoading={assetsQuery.isLoading}
      />
    </div>
  );
}
