import { useMemo } from "react";
import { CheckCircle2, ExternalLink, Hammer, Link as LinkIcon, Sparkles } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import { cn } from "@/lib/utils";
import type { StudyDesignAsset } from "../../../types/study";
import type { useStudyDesignWorkbench } from "../../../hooks/useStudyDesignWorkbench";
import {
  draftPayloadRecord,
  issueMessages,
  normalizeCohortRole,
  recordValue,
  textValue,
} from "../../workbench/studyDesignWorkbenchHelpers";
import { ActionGateHint } from "../../workbench/shared/ActionGateHint";
import { PipelineGlyph, type PipelineGlyphState } from "../shared/PipelineGlyph";

// Station 04 — Cohorts. Three vertical cards side-by-side:
// Target / Comparator / Outcome. Each card displays:
//   - role eyebrow (mono)
//   - linked cohort definition title (serif)
//   - horizontal 4-stop pipeline glyph
//   - per-source patient counts (—if unavailable)
//   - inline blocker callout via ActionGateHint
//   - per-card actions: edit, verify, materialize, link / unlink, open native
//
// All actions route through the same v1 hook mutations.

type Workbench = ReturnType<typeof useStudyDesignWorkbench>;

const ROLES: ReadonlyArray<"target" | "comparator" | "outcome"> = [
  "target",
  "comparator",
  "outcome",
];

interface RoleCard {
  role: "target" | "comparator" | "outcome";
  asset: StudyDesignAsset | null;
  /** Title from draft payload OR linked cohort definition name. */
  title: string;
  glyphState: PipelineGlyphState;
  glyphBlocked: boolean;
  perSourceCounts: ReadonlyArray<{ source: string; count: string }>;
  blockerMessage: string | null;
  isVerified: boolean;
  isAccepted: boolean;
  isMaterialized: boolean;
  isLinked: boolean;
  materializedId: number | null;
}

function deriveGlyphState(asset: StudyDesignAsset | null): PipelineGlyphState {
  if (!asset) return "draft";
  const provenance = recordValue(asset.provenance_json);
  const linked = provenance?.study_cohort_id != null;
  if (linked) return "linked";
  if (asset.status === "materialized" && asset.materialized_id != null) return "materialized";
  if (asset.verification_status === "verified" || asset.status === "accepted") return "verified";
  return "draft";
}

function suppressedLabel(count: number | null | undefined, suppressed: boolean | undefined): string {
  if (suppressed) return "<small";
  if (count == null) return "—";
  return Number(count).toLocaleString();
}

function perSourceCountsForRole(
  role: "target" | "comparator" | "outcome",
  assets: ReadonlyArray<StudyDesignAsset>,
): ReadonlyArray<{ source: string; count: string }> {
  const feasibility = assets
    .filter((asset) => asset.asset_type === "feasibility_result")
    .sort((a, b) => b.id - a.id)[0];
  if (!feasibility) return [];

  const payload = recordValue(feasibility.draft_payload_json);
  const sourcesField = Array.isArray(payload?.sources) ? payload?.sources : null;
  if (!sourcesField) return [];

  const result: Array<{ source: string; count: string }> = [];
  for (const source of sourcesField) {
    if (!source || typeof source !== "object") continue;
    const sourceRecord = source as Record<string, unknown>;
    const cohorts = Array.isArray(sourceRecord.cohorts) ? sourceRecord.cohorts : [];
    const match = cohorts.find((cohort) => {
      if (!cohort || typeof cohort !== "object") return false;
      const cohortRecord = cohort as Record<string, unknown>;
      return normalizeCohortRole(String(cohortRecord.role ?? "")) === role;
    }) as Record<string, unknown> | undefined;
    if (!match) continue;
    const count = typeof match.person_count === "number" ? match.person_count : null;
    const suppressed = match.person_count_suppressed === true;
    const sourceName = typeof sourceRecord.source_name === "string" ? sourceRecord.source_name : "—";
    result.push({ source: sourceName, count: suppressedLabel(count, suppressed) });
  }
  return result;
}

function buildRoleCard(
  role: "target" | "comparator" | "outcome",
  assets: ReadonlyArray<StudyDesignAsset>,
): RoleCard {
  const drafts = assets
    .filter((asset) => asset.asset_type === "cohort_draft")
    .filter((asset) => {
      const payload = draftPayloadRecord(asset);
      const raw = String(payload.role ?? asset.role ?? "");
      return normalizeCohortRole(raw) === role;
    })
    .sort((a, b) => b.id - a.id);

  const asset = drafts[0] ?? null;
  const payload = asset ? draftPayloadRecord(asset) : {};
  const verification = asset ? recordValue(asset.verification_json) : null;
  const provenance = asset ? recordValue(asset.provenance_json) : null;
  const blockers = issueMessages(verification?.blocking_reasons);
  const warnings = issueMessages(verification?.warnings);

  return {
    role,
    asset,
    title: asset
      ? textValue(payload.title) || `Cohort draft #${asset.id}`
      : tAuto("studies.v2.cohorts.noCohortLinked"),
    glyphState: deriveGlyphState(asset),
    glyphBlocked: asset?.verification_status === "blocked",
    perSourceCounts: perSourceCountsForRole(role, assets),
    blockerMessage: blockers[0] ?? warnings[0] ?? null,
    isVerified: asset?.verification_status === "verified",
    isAccepted: asset?.status === "accepted",
    isMaterialized: asset != null && asset.status === "materialized" && asset.materialized_id != null,
    isLinked: provenance?.study_cohort_id != null,
    materializedId: asset?.materialized_id ?? null,
  };
}

interface CohortTriptychProps {
  workbench: Pick<
    Workbench,
    | "assets"
    | "cohortReadinessQuery"
    | "selectedSession"
    | "selectedVersion"
    | "handleDraftCohorts"
    | "handleVerifyCohortDraft"
    | "handleMaterializeCohortDraft"
    | "handleLinkCohortDraft"
    | "handleReviewAsset"
    | "draftCohorts"
    | "verifyCohortDraft"
    | "materializeCohortDraft"
    | "linkCohortDraft"
    | "reviewAsset"
  >;
}

export function CohortTriptych({ workbench }: CohortTriptychProps): JSX.Element {
  const {
    assets,
    cohortReadinessQuery,
    selectedSession,
    selectedVersion,
    handleDraftCohorts,
    handleVerifyCohortDraft,
    handleMaterializeCohortDraft,
    handleLinkCohortDraft,
    handleReviewAsset,
    draftCohorts,
    verifyCohortDraft,
    materializeCohortDraft,
    linkCohortDraft,
    reviewAsset,
  } = workbench;

  const cards = useMemo<ReadonlyArray<RoleCard>>(
    () => ROLES.map((role) => buildRoleCard(role, assets)),
    [assets],
  );

  const materializedConceptSetCount = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.asset_type === "concept_set_draft" &&
          asset.status === "materialized" &&
          asset.materialized_id != null,
      ).length,
    [assets],
  );

  const canDraftCohorts =
    selectedSession != null && selectedVersion != null && materializedConceptSetCount > 0;
  const draftGate = !canDraftCohorts
    ? tAuto("studies.v2.cohorts.materializeConceptSetFirst")
    : null;

  const readiness = cohortReadinessQuery.data ?? null;
  const ready = readiness?.ready_for_feasibility === true || readiness?.ready === true;

  return (
    <div className="cohort-triptych-stage">
      <header className="cohort-triptych-head">
        <div className="cohort-triptych-eyebrow wb-mono">
          {tAuto("studies.v2.cohorts.stageLabel")}
        </div>
        <div className="cohort-triptych-headline">
          <h2 className="cohort-triptych-title wb-serif">
            {tAuto("studies.v2.cohorts.title")}
          </h2>
          <div className="cohort-triptych-actions-top">
            <span
              className={cn(
                "cohort-triptych-readiness wb-mono",
                ready ? "ready" : "blocked",
              )}
            >
              {ready
                ? tAuto("studies.v2.cohorts.ready")
                : tAuto("studies.v2.cohorts.blocked")}
            </span>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleDraftCohorts}
              disabled={!canDraftCohorts || draftCohorts.isPending}
              title={draftGate ?? undefined}
            >
              <Sparkles size={12} />
              {tAuto("studies.v2.cohorts.draftCohorts")}
            </button>
          </div>
        </div>
      </header>

      <ActionGateHint message={draftGate} />

      <div className="cohort-triptych">
        {cards.map((card) => (
          <article key={card.role} className="cohort-triptych-card" aria-label={card.role}>
            <div className="cohort-triptych-role wb-mono">{card.role.toUpperCase()}</div>
            <h3 className="cohort-triptych-card-title wb-serif">{card.title}</h3>
            <div className="cohort-triptych-pipeline">
              <PipelineGlyph state={card.glyphState} blocked={card.glyphBlocked} size="md" />
            </div>
            <div className="cohort-triptych-counts">
              {card.perSourceCounts.length === 0 ? (
                <span className="asset-matrix-muted wb-mono">—</span>
              ) : (
                <ul className="cohort-triptych-counts-list">
                  {card.perSourceCounts.map((entry) => (
                    <li key={entry.source}>
                      <span className="cohort-triptych-counts-source wb-mono">
                        {entry.source}
                      </span>
                      <span className="cohort-triptych-counts-value wb-mono">
                        {entry.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {card.blockerMessage ? (
              <ActionGateHint message={card.blockerMessage} />
            ) : null}
            <div className="cohort-triptych-card-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (card.materializedId != null) {
                    window.open(
                      `/cohort-definitions/${card.materializedId}`,
                      "_blank",
                      "noopener",
                    );
                  }
                }}
                disabled={card.materializedId == null}
                title={tAuto("studies.v2.cohorts.action.editTitle")}
              >
                <ExternalLink size={12} />
                {tAuto("studies.v2.cohorts.action.edit")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (card.asset) handleVerifyCohortDraft(card.asset);
                }}
                disabled={
                  card.asset == null ||
                  card.isMaterialized ||
                  card.isVerified ||
                  verifyCohortDraft.isPending
                }
              >
                <CheckCircle2 size={12} />
                {tAuto("studies.v2.cohorts.action.verify")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (card.asset) handleReviewAsset(card.asset, "accept", null);
                }}
                disabled={
                  card.asset == null ||
                  card.isMaterialized ||
                  card.isAccepted ||
                  !card.isVerified ||
                  reviewAsset.isPending
                }
              >
                <CheckCircle2 size={12} />
                {tAuto("studies.v2.cohorts.action.accept")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (card.asset) handleMaterializeCohortDraft(card.asset);
                }}
                disabled={
                  card.asset == null ||
                  card.isMaterialized ||
                  !card.isAccepted ||
                  materializeCohortDraft.isPending
                }
              >
                <Hammer size={12} />
                {tAuto("studies.v2.cohorts.action.materialize")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (card.asset) handleLinkCohortDraft(card.asset, card.role);
                }}
                disabled={
                  card.asset == null ||
                  !card.isMaterialized ||
                  card.isLinked ||
                  linkCohortDraft.isPending
                }
              >
                <LinkIcon size={12} />
                {card.isLinked
                  ? tAuto("studies.v2.cohorts.action.unlink")
                  : tAuto("studies.v2.cohorts.action.link")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
