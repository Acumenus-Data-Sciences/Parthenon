import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useApproveMappingMutation,
  useEscalateMappingMutation,
  useMappingReviewDetail,
  useRejectMappingMutation,
} from "../api";
import { CandidateCard } from "../components/CandidateCard";
import { EscalateModal } from "../components/EscalateModal";
import { KeyboardHelpOverlay } from "../components/KeyboardHelpOverlay";
import { RejectModal } from "../components/RejectModal";
import { StatusPill } from "../components/StatusPill";
import { useReviewerKeyboardShortcuts } from "../hooks/useReviewerKeyboardShortcuts";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function MappingReviewDetailPage() {
  const params = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const queueId = useMemo(() => Number(params.queueId), [params.queueId]);
  const detailQuery = useMappingReviewDetail(
    Number.isFinite(queueId) && queueId > 0 ? queueId : null,
  );

  const [focusedCard, setFocusedCard] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const approveMutation = useApproveMappingMutation();
  const rejectMutation = useRejectMappingMutation();
  const escalateMutation = useEscalateMappingMutation();
  const anyMutationBusy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    escalateMutation.isPending;

  const detail = detailQuery.data;
  const candidates = detail?.candidates ?? [];

  // Clamp focused card to candidate range whenever the list changes.
  useEffect(() => {
    if (focusedCard >= candidates.length && candidates.length > 0) {
      setFocusedCard(0);
    }
  }, [candidates.length, focusedCard]);

  // Keep focus visible.
  useEffect(() => {
    if (helpOpen || rejectOpen || escalateOpen) return;
    cardRefs.current[focusedCard]?.focus();
  }, [focusedCard, helpOpen, rejectOpen, escalateOpen]);

  function handleApprove(conceptId: number) {
    approveMutation.mutate(
      { queueId, body: { concept_id: conceptId } },
      {
        onSuccess: () => navigate("/admin/mapping-review"),
      },
    );
  }

  function handleReject(reason: string) {
    rejectMutation.mutate(
      { queueId, body: { rejection_reason: reason } },
      {
        onSuccess: () => {
          setRejectOpen(false);
          navigate("/admin/mapping-review");
        },
      },
    );
  }

  function handleEscalate(note: string) {
    escalateMutation.mutate(
      { queueId, body: { note } },
      {
        onSuccess: () => {
          setEscalateOpen(false);
          navigate("/admin/mapping-review");
        },
      },
    );
  }

  useReviewerKeyboardShortcuts({
    onNext: () =>
      setFocusedCard((i) => Math.min(candidates.length - 1, i + 1)),
    onPrev: () => setFocusedCard((i) => Math.max(0, i - 1)),
    onApprove: () => {
      const c = candidates[focusedCard];
      if (c && c.concept_still_valid && !anyMutationBusy) {
        handleApprove(c.concept_id);
      }
    },
    onReject: () => setRejectOpen(true),
    onEscalate: () => setEscalateOpen(true),
    onHelpToggle: () => setHelpOpen((v) => !v),
    onEscape: () => {
      if (rejectOpen) setRejectOpen(false);
      else if (escalateOpen) setEscalateOpen(false);
      else if (helpOpen) setHelpOpen(false);
      else navigate("/admin/mapping-review");
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div
          className="h-96 animate-pulse rounded-xl bg-zinc-900"
          aria-busy="true"
        >
          <span className="sr-only">Loading…</span>
        </div>
      </div>
    );
  }

  if (detailQuery.error || !detail) {
    const message =
      detailQuery.error instanceof Error
        ? detailQuery.error.message
        : "Unable to load this queue row.";
    return (
      <div
        role="alert"
        className="mx-auto max-w-3xl rounded-xl border border-[#9B1B30]/50 bg-[#9B1B30]/10 px-4 py-6 text-center text-[#FCA5A5]"
      >
        <p>{message}</p>
        <Link
          to="/admin/mapping-review"
          className="mt-3 inline-block text-sm underline"
        >
          Back to queue
        </Link>
      </div>
    );
  }

  const isResolved = detail.status !== "pending";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 text-zinc-100">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/admin/mapping-review"
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← Back to queue{" "}
          <kbd className="ml-1 rounded border border-zinc-700 px-1 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>
        </Link>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          aria-keyshortcuts="?"
        >
          <kbd className="font-mono text-xs">?</kbd> Keyboard
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-4">
          <section className="rounded-xl border border-zinc-800 bg-[#0E0E11]/60 p-5">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Source code
            </div>
            <div className="mt-1 break-all font-mono text-xl text-zinc-100">
              {detail.source_code}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {detail.source_vocab}
              </span>
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                seen {detail.seen_count}×
              </span>
            </div>
            {detail.source_text && (
              <p className="mt-3 italic text-zinc-300">{detail.source_text}</p>
            )}
            <div className="mt-4 grid gap-2 text-xs text-zinc-500">
              <Row label="Created" value={formatTimestamp(detail.created_at)} />
              {detail.reviewed_at && (
                <Row label="Reviewed" value={formatTimestamp(detail.reviewed_at)} />
              )}
              {detail.escalated_at && (
                <Row label="Escalated" value={formatTimestamp(detail.escalated_at)} />
              )}
              {detail.reviewer && (
                <Row label="Reviewer" value={detail.reviewer.name} />
              )}
              <Row label="Model" value={detail.model_version} mono />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-[#0E0E11]/60 p-5">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              Status
            </div>
            <StatusPill status={detail.status} />
            {detail.rejection_reason && (
              <div className="mt-3 rounded border-l-2 border-zinc-700 bg-zinc-900/50 p-3 text-sm italic text-zinc-300">
                {detail.rejection_reason}
              </div>
            )}
            {detail.approved_concept_id && (
              <div className="mt-3 text-sm text-zinc-300">
                Approved concept_id{" "}
                <span className="font-mono text-[#2DD4BF]">
                  {detail.approved_concept_id}
                </span>
              </div>
            )}
          </section>
        </aside>

        <main className="space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">
              Top {candidates.length} candidates
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                disabled={isResolved || anyMutationBusy}
                className="rounded-lg border border-[#9B1B30]/50 bg-[#9B1B30]/10 px-3 py-1.5 text-sm text-[#FCA5A5] hover:bg-[#9B1B30]/20 disabled:cursor-not-allowed disabled:opacity-50"
                aria-keyshortcuts="R"
              >
                <kbd className="mr-1 font-mono text-xs">R</kbd>Reject
              </button>
              <button
                type="button"
                onClick={() => setEscalateOpen(true)}
                disabled={isResolved || anyMutationBusy}
                className="rounded-lg border border-[#C9A227]/50 bg-[#C9A227]/10 px-3 py-1.5 text-sm text-[#FBE187] hover:bg-[#C9A227]/20 disabled:cursor-not-allowed disabled:opacity-50"
                aria-keyshortcuts="E"
              >
                <kbd className="mr-1 font-mono text-xs">E</kbd>Escalate
              </button>
            </div>
          </div>

          {candidates.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-[#0E0E11]/60 p-8 text-center text-zinc-400">
              No candidates were generated by the rerank pipeline. This typically
              means the source code didn't have enough text context. Reject or
              escalate.
            </div>
          )}

          <div className="space-y-3">
            {candidates.map((c, i) => (
              <CandidateCard
                key={c.concept_id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                candidate={c}
                rank={i + 1}
                isFocused={i === focusedCard}
                busy={anyMutationBusy || isResolved}
                onApprove={(cid) => handleApprove(cid)}
                onClick={() => setFocusedCard(i)}
              />
            ))}
          </div>
        </main>
      </div>

      <RejectModal
        open={rejectOpen}
        busy={rejectMutation.isPending}
        onClose={() => setRejectOpen(false)}
        onSubmit={handleReject}
      />
      <EscalateModal
        open={escalateOpen}
        busy={escalateMutation.isPending}
        onClose={() => setEscalateOpen(false)}
        onSubmit={handleEscalate}
      />
      <KeyboardHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className={`text-zinc-300 ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default MappingReviewDetailPage;
