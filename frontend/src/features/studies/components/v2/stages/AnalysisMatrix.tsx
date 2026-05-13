import { useMemo } from "react";
import { CheckCircle2, ExternalLink, Hammer, Sparkles } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import type {
  StudyAnalysisPlanDraft,
  StudyDesignAsset,
} from "../../../types/study";
import type { useStudyDesignWorkbench } from "../../../hooks/useStudyDesignWorkbench";
import {
  analysisDetailPath,
  draftPayloadRecord,
  isRecord,
} from "../../workbench/studyDesignWorkbenchHelpers";
import { ActionGateHint } from "../../workbench/shared/ActionGateHint";
import { AssetMatrix, type AssetMatrixColumn, type AssetMatrixRowAction } from "./AssetMatrix";
import { PipelineGlyph, type PipelineGlyphState } from "../shared/PipelineGlyph";

// Station 06 — Analyses. Configures AssetMatrix for the analysis plan
// verify/materialize flow that v1 rendered as `AnalysisPlanPanel`. Mirrors the
// v1 mutations 1-for-1 (verifyAnalysisPlan + materializeAnalysisPlan + review).

type Workbench = ReturnType<typeof useStudyDesignWorkbench>;

export interface AnalysisRow {
  id: number;
  asset: StudyDesignAsset;
  family: string;
  name: string;
  hadesStatus: string;
  hadesPackage: string;
  glyphState: PipelineGlyphState;
  glyphBlocked: boolean;
  detailPath: string | null;
  isVerified: boolean;
  isAccepted: boolean;
  isMaterialized: boolean;
}

function payloadAsDraft(asset: StudyDesignAsset): Partial<StudyAnalysisPlanDraft> {
  return draftPayloadRecord(asset) as Partial<StudyAnalysisPlanDraft>;
}

function deriveGlyphState(asset: StudyDesignAsset): PipelineGlyphState {
  if (asset.status === "materialized" && asset.materialized_id != null) return "materialized";
  if (asset.status === "accepted" || asset.verification_status === "verified") return "verified";
  return "draft";
}

function hadesStatusLabel(payload: Partial<StudyAnalysisPlanDraft>): string {
  const cap = payload.hades_capability;
  if (cap?.installed) return cap.version ? `installed (${cap.version})` : "installed";
  if (cap?.status) return cap.status;
  return "missing";
}

function assetToRow(asset: StudyDesignAsset): AnalysisRow {
  const payload = payloadAsDraft(asset);
  const family =
    payload.analysis_family?.label ?? payload.analysis_type ?? "analysis";
  const name = payload.title ?? `${family} plan #${asset.id}`;
  const hadesPackage = payload.hades_package ?? payload.analysis_family?.hades_package ?? "—";
  const isBlocked = asset.verification_status === "blocked";

  return {
    id: asset.id,
    asset,
    family: String(family),
    name,
    hadesStatus: hadesStatusLabel(payload),
    hadesPackage,
    glyphState: deriveGlyphState(asset),
    glyphBlocked: isBlocked,
    detailPath: analysisDetailPath(payload.analysis_type, asset.materialized_id),
    isVerified: asset.verification_status === "verified",
    isAccepted: asset.status === "accepted",
    isMaterialized: asset.status === "materialized" && asset.materialized_id != null,
  };
}

interface AnalysisMatrixProps {
  workbench: Pick<
    Workbench,
    | "assets"
    | "selectedSession"
    | "selectedVersion"
    | "handleDraftAnalysisPlans"
    | "handleVerifyAnalysisPlan"
    | "handleMaterializeAnalysisPlan"
    | "handleReviewAsset"
    | "draftAnalysisPlans"
    | "verifyAnalysisPlan"
    | "materializeAnalysisPlan"
    | "reviewAsset"
    | "assetsQuery"
  >;
}

export function AnalysisMatrix({ workbench }: AnalysisMatrixProps): JSX.Element {
  const {
    assets,
    selectedSession,
    selectedVersion,
    handleDraftAnalysisPlans,
    handleVerifyAnalysisPlan,
    handleMaterializeAnalysisPlan,
    handleReviewAsset,
    draftAnalysisPlans,
    verifyAnalysisPlan,
    materializeAnalysisPlan,
    reviewAsset,
    assetsQuery,
  } = workbench;

  const rows = useMemo<ReadonlyArray<AnalysisRow>>(() => {
    return assets
      .filter((asset) => asset.asset_type === "analysis_plan")
      .sort((left, right) =>
        (right.rank_score ?? -1) - (left.rank_score ?? -1) || right.id - left.id,
      )
      .map(assetToRow);
  }, [assets]);

  const hasFeasibilityResult = useMemo(
    () =>
      assets.some((asset) => asset.asset_type === "feasibility_result" && isRecord(asset.draft_payload_json)),
    [assets],
  );

  const canDraft =
    selectedSession != null && selectedVersion != null && hasFeasibilityResult;
  const draftGate = !canDraft
    ? tAuto("studies.v2.analyses.runFeasibilityFirst")
    : null;

  const materializedCount = rows.filter((row) => row.isMaterialized).length;

  const columns: ReadonlyArray<AssetMatrixColumn<AnalysisRow>> = [
    {
      key: "family",
      label: tAuto("studies.v2.analyses.col.family"),
      width: "minmax(140px, 1.4fr)",
      render: (row) => <span className="asset-matrix-muted">{row.family}</span>,
    },
    {
      key: "name",
      label: tAuto("studies.v2.analyses.col.name"),
      width: "minmax(180px, 2fr)",
      render: (row) => <span className="asset-matrix-name">{row.name}</span>,
    },
    {
      key: "hadesStatus",
      label: tAuto("studies.v2.analyses.col.hades"),
      width: "140px",
      render: (row) => <span className="wb-mono asset-matrix-muted">{row.hadesStatus}</span>,
    },
    {
      key: "hadesPackage",
      label: tAuto("studies.v2.analyses.col.package"),
      width: "150px",
      render: (row) => <span className="wb-mono asset-matrix-muted">{row.hadesPackage}</span>,
    },
    {
      key: "glyph",
      label: tAuto("studies.v2.analyses.col.status"),
      width: "160px",
      render: (row) => (
        <PipelineGlyph state={row.glyphState} blocked={row.glyphBlocked} size="sm" />
      ),
    },
  ];

  const rowActions: ReadonlyArray<AssetMatrixRowAction<AnalysisRow>> = [
    {
      id: "verify",
      label: tAuto("studies.v2.analyses.action.verify"),
      icon: CheckCircle2,
      tone: "teal",
      disabled: (row) =>
        row.isMaterialized ||
        row.isAccepted ||
        verifyAnalysisPlan.isPending,
      onClick: (row) => handleVerifyAnalysisPlan(row.asset),
    },
    {
      id: "accept",
      label: tAuto("studies.v2.analyses.action.accept"),
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
      label: tAuto("studies.v2.analyses.action.materialize"),
      icon: Hammer,
      tone: "teal",
      disabled: (row) =>
        row.isMaterialized || !row.isAccepted || materializeAnalysisPlan.isPending,
      onClick: (row) => handleMaterializeAnalysisPlan(row.asset),
    },
    {
      id: "open",
      label: tAuto("studies.v2.analyses.action.open"),
      icon: ExternalLink,
      disabled: (row) => !row.isMaterialized || row.detailPath == null,
      onClick: (row) => {
        if (row.detailPath) {
          window.open(row.detailPath, "_blank", "noopener");
        }
      },
    },
  ];

  return (
    <div className="asset-matrix-stage">
      <ActionGateHint message={draftGate} />
      <AssetMatrix<AnalysisRow>
        stageLabel={tAuto("studies.v2.analyses.stageLabel")}
        title={
          tAuto("studies.v2.analyses.titleTemplate") +
          ` — ${rows.length} plans, ${materializedCount} materialized`
        }
        columns={columns}
        rows={rows}
        rowActions={rowActions}
        headerActions={[
          {
            id: "draft",
            label: tAuto("studies.v2.analyses.draft"),
            icon: Sparkles,
            onClick: () => handleDraftAnalysisPlans(),
            disabled: !canDraft || draftAnalysisPlans.isPending,
            title: draftGate ?? undefined,
          },
        ]}
        emptyState={{
          title: tAuto("studies.v2.analyses.empty.title"),
          description: tAuto("studies.v2.analyses.empty.description"),
          cta: {
            label: tAuto("studies.v2.analyses.empty.cta"),
            onClick: () => handleDraftAnalysisPlans(),
            disabled: !canDraft || draftAnalysisPlans.isPending,
            title: draftGate ?? undefined,
          },
        }}
        isLoading={assetsQuery.isLoading}
      />
    </div>
  );
}
