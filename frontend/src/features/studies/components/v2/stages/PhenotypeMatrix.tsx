import { useMemo } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import type { StudyDesignAsset } from "../../../types/study";
import type { useStudyDesignWorkbench } from "../../../hooks/useStudyDesignWorkbench";
import {
  draftPayloadRecord,
  issueMessages,
  recordValue,
  sourceLabel,
  textAt,
  textValue,
} from "../../workbench/studyDesignWorkbenchHelpers";
import { ActionGateHint } from "../../workbench/shared/ActionGateHint";
import { AssetMatrix, type AssetMatrixColumn, type AssetMatrixRowAction } from "./AssetMatrix";
import { PipelineGlyph, type PipelineGlyphState } from "../shared/PipelineGlyph";
import { ProvenanceDot, type ProvenanceSource } from "../shared/ProvenanceDot";

// Station 02 — Phenotypes. Configures AssetMatrix for the phenotype
// recommendation review flow that v1 rendered as `PhenotypeRecommendationPanel`.
// Mirrors the v1 mutations 1-for-1 (recommendPhenotypes + reviewAsset).

type Workbench = ReturnType<typeof useStudyDesignWorkbench>;

export interface PhenotypeRow {
  id: number;
  /** The underlying asset, kept so column renderers and actions can read it. */
  asset: StudyDesignAsset;
  name: string;
  conceptSummary: string;
  endpointSummary: string;
  glyphState: PipelineGlyphState;
  glyphBlocked: boolean;
  provenance: ProvenanceMeta | null;
  blockerMessage: string | null;
  isReviewed: boolean;
  isVerified: boolean;
  acceptDisabledReason: string | null;
}

interface ProvenanceMeta {
  source: ProvenanceSource;
  page?: number;
  confidence?: number;
  hint?: string;
}

const PHENOTYPE_ASSET_TYPES = [
  "phenotype_recommendation",
  "local_cohort",
  "local_concept_set",
];

function mapAssetToProvenance(asset: StudyDesignAsset): ProvenanceMeta | null {
  const verification = recordValue(asset.verification_json);
  const provenance = recordValue(asset.provenance_json);
  const rawSource =
    textAt(verification, "source_summary.source") ||
    textValue(provenance?.source) ||
    textValue(asset.rank_score_json?.source);
  if (!rawSource) return null;

  const normalized = rawSource.toLowerCase();
  const source: ProvenanceSource =
    normalized.includes("protocol") ? "protocol"
      : normalized.includes("ai") || normalized.includes("abby") || normalized.includes("llm") ? "ai"
        : normalized.includes("manual") ? "manual"
          : normalized.includes("import") ? "imported"
            : "inferred";

  const score = typeof asset.rank_score === "number" ? asset.rank_score : null;
  const confidence = score != null && score >= 0 && score <= 1 ? score : undefined;
  const page = typeof provenance?.page === "number" ? provenance.page : undefined;
  const hint = sourceLabel(rawSource);

  return { source, page, confidence, hint };
}

function assetToRow(asset: StudyDesignAsset): PhenotypeRow {
  const payload = draftPayloadRecord(asset);
  const verification = recordValue(asset.verification_json);
  const blockers = issueMessages(verification?.blocking_reasons);
  const warnings = issueMessages(verification?.warnings);
  const blockerMessage = blockers[0] ?? warnings[0] ?? null;
  const verified = asset.verification_status === "verified";
  const reviewed = ["accepted", "rejected", "deferred"].includes(asset.status);
  const isBlocked = asset.verification_status === "blocked";

  let glyphState: PipelineGlyphState = "draft";
  if (asset.status === "materialized") glyphState = "materialized";
  else if (asset.status === "accepted") glyphState = "verified";
  else if (verified) glyphState = "verified";

  return {
    id: asset.id,
    asset,
    name: textValue(payload.title) || `Recommendation #${asset.id}`,
    conceptSummary: textValue(payload.description) || textValue(payload.domain) || "—",
    endpointSummary: textValue(payload.rationale) || "—",
    glyphState,
    glyphBlocked: isBlocked,
    provenance: mapAssetToProvenance(asset),
    blockerMessage,
    isReviewed: reviewed,
    isVerified: verified,
    acceptDisabledReason: verified
      ? null
      : textAt(verification, "eligibility.reason") || tAuto("studies.v2.phenotypes.onlyVerified"),
  };
}

interface PhenotypeMatrixProps {
  workbench: Pick<
    Workbench,
    | "assets"
    | "selectedSession"
    | "selectedVersion"
    | "handleRecommendPhenotypes"
    | "handleReviewAsset"
    | "recommendPhenotypes"
    | "reviewAsset"
    | "assetsQuery"
  >;
}

export function PhenotypeMatrix({ workbench }: PhenotypeMatrixProps): JSX.Element {
  const {
    assets,
    selectedSession,
    selectedVersion,
    handleRecommendPhenotypes,
    handleReviewAsset,
    recommendPhenotypes,
    reviewAsset,
    assetsQuery,
  } = workbench;

  const rows = useMemo<ReadonlyArray<PhenotypeRow>>(() => {
    return assets
      .filter((asset) => PHENOTYPE_ASSET_TYPES.includes(asset.asset_type))
      .sort((left, right) =>
        (right.rank_score ?? -1) - (left.rank_score ?? -1) || right.id - left.id,
      )
      .map(assetToRow);
  }, [assets]);

  const verifiedCount = rows.filter((row) => row.isVerified).length;
  const reviewedCount = rows.filter((row) => row.isReviewed).length;

  const canGenerate =
    selectedSession != null &&
    selectedVersion != null &&
    (selectedVersion.status === "accepted" || selectedVersion.status === "review_ready");
  const generateGate = !canGenerate
    ? tAuto("studies.v2.phenotypes.saveOrAcceptFirst")
    : null;

  const columns: ReadonlyArray<AssetMatrixColumn<PhenotypeRow>> = [
    {
      key: "name",
      label: tAuto("studies.v2.phenotypes.col.name"),
      width: "minmax(180px, 2fr)",
      render: (row) => <span className="asset-matrix-name">{row.name}</span>,
    },
    {
      key: "conceptSummary",
      label: tAuto("studies.v2.phenotypes.col.concepts"),
      width: "minmax(120px, 1.5fr)",
      render: (row) => <span className="asset-matrix-muted">{row.conceptSummary}</span>,
    },
    {
      key: "endpointSummary",
      label: tAuto("studies.v2.phenotypes.col.endpoints"),
      width: "minmax(120px, 1.5fr)",
      render: (row) => <span className="asset-matrix-muted">{row.endpointSummary}</span>,
    },
    {
      key: "glyph",
      label: tAuto("studies.v2.phenotypes.col.status"),
      width: "160px",
      render: (row) => (
        <PipelineGlyph state={row.glyphState} blocked={row.glyphBlocked} size="sm" />
      ),
    },
    {
      key: "provenance",
      label: tAuto("studies.v2.phenotypes.col.provenance"),
      width: "160px",
      render: (row) =>
        row.provenance ? (
          <ProvenanceDot
            source={row.provenance.source}
            page={row.provenance.page}
            confidence={row.provenance.confidence}
            hint={row.provenance.hint}
          />
        ) : (
          <span className="asset-matrix-muted">—</span>
        ),
    },
  ];

  const rowActions: ReadonlyArray<AssetMatrixRowAction<PhenotypeRow>> = [
    {
      id: "accept",
      label: tAuto("studies.v2.phenotypes.action.accept"),
      icon: Check,
      tone: "teal",
      disabled: (row) =>
        row.isReviewed || !row.isVerified || reviewAsset.isPending,
      onClick: (row) => handleReviewAsset(row.asset, "accept", null),
    },
    {
      id: "reject",
      label: tAuto("studies.v2.phenotypes.action.reject"),
      icon: X,
      disabled: (row) => row.isReviewed || reviewAsset.isPending,
      onClick: (row) => handleReviewAsset(row.asset, "reject", null),
    },
  ];

  return (
    <div className="asset-matrix-stage">
      <ActionGateHint message={generateGate} />
      <AssetMatrix<PhenotypeRow>
        stageLabel={tAuto("studies.v2.phenotypes.stageLabel")}
        title={tAuto("studies.v2.phenotypes.titleTemplate") +
          ` — ${rows.length} drafts, ${verifiedCount} verified, ${reviewedCount} reviewed`}
        columns={columns}
        rows={rows}
        rowActions={rowActions}
        headerActions={[
          {
            id: "recommend",
            label: tAuto("studies.v2.phenotypes.recommend"),
            icon: Sparkles,
            onClick: handleRecommendPhenotypes,
            disabled: !canGenerate || recommendPhenotypes.isPending,
            title: generateGate ?? undefined,
          },
        ]}
        emptyState={{
          title: tAuto("studies.v2.phenotypes.empty.title"),
          description: tAuto("studies.v2.phenotypes.empty.description"),
          cta: {
            label: tAuto("studies.v2.phenotypes.empty.cta"),
            onClick: handleRecommendPhenotypes,
            disabled: !canGenerate || recommendPhenotypes.isPending,
            title: generateGate ?? undefined,
          },
        }}
        isLoading={assetsQuery.isLoading}
      />
    </div>
  );
}
