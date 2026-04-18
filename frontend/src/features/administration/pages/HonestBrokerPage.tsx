import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Loader2, Mail, RotateCw, Send, ShieldCheck, UserPlus, Users, Search, ExternalLink, CheckCircle2, Ban } from "lucide-react";
import { Modal, toast } from "@/components/ui";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { useAuthStore } from "@/stores/authStore";
import type { HonestBrokerAuditLogApi, HonestBrokerInvitationApi, HonestBrokerLinkApi, SurveyCampaignApi } from "@/features/standard-pros/api/campaignApi";
import {
  useCampaignHonestBrokerAuditLogs,
  useCampaignHonestBrokerInvitations,
  useCampaignHonestBrokerLinks,
  useCampaigns,
  useCreateCampaignHonestBrokerLink,
  useResendCampaignHonestBrokerInvitation,
  useRevokeCampaignHonestBrokerInvitation,
  useSendCampaignHonestBrokerInvitation,
} from "@/features/standard-pros/hooks/useCampaigns";

function CampaignStatusBadge({ status }: { status: SurveyCampaignApi["status"] }) {
  const { t } = useTranslation("app");
  const className = {
    draft: "bg-accent/10 text-accent",
    active: "bg-success/10 text-success",
    closed: "bg-critical/10 text-critical",
  }[status];

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${className}`}>
      {t(`administration.honestBroker.campaignStatuses.${status}`, { defaultValue: status })}
    </span>
  );
}

function BrokerMatchBadge({ status }: { status: string }) {
  const { t } = useTranslation("app");
  const normalized = status.toLowerCase();
  const className =
    normalized === "submitted"
      ? "bg-success/10 text-success"
      : normalized === "registered"
        ? "bg-info/10 text-info"
        : "bg-accent/10 text-accent";

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${className}`}>
      {t(`administration.honestBroker.matchStatuses.${normalized}`, { defaultValue: status })}
    </span>
  );
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-4">
      <div className="text-lg font-semibold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-text-ghost">{label}</div>
    </div>
  );
}

function RegisterParticipantModal({
  open,
  campaign,
  isSaving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  campaign: SurveyCampaignApi | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    respondent_identifier: string;
    person_id?: number | null;
    notes?: string | null;
  }) => void;
}) {
  const { t } = useTranslation("app");
  const [respondentIdentifier, setRespondentIdentifier] = useState("");
  const [personId, setPersonId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      setRespondentIdentifier("");
      setPersonId("");
      setNotes("");
    });
  }, [open, campaign?.id]);

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-muted hover:text-text-primary"
      >
        {t("administration.honestBroker.actions.cancel")}
      </button>
      <button
        type="button"
        disabled={isSaving || respondentIdentifier.trim().length === 0}
        onClick={() =>
          onSubmit({
            respondent_identifier: respondentIdentifier.trim(),
            person_id: personId.trim().length > 0 ? Number(personId) : null,
            notes: notes.trim().length > 0 ? notes.trim() : null,
          })
        }
        className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base disabled:opacity-50"
      >
        {isSaving
          ? t("administration.honestBroker.registerModal.registering")
          : t("administration.honestBroker.actions.registerParticipant")}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={campaign
        ? t("administration.honestBroker.registerModal.titleWithCampaign", { campaign: campaign.name })
        : t("administration.honestBroker.registerModal.title")}
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-muted">
          {t("administration.honestBroker.registerModal.description")}
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-ghost">
              {t("administration.honestBroker.registerModal.respondentIdentifier")}
            </div>
            <input
              type="text"
              value={respondentIdentifier}
              onChange={(event) => setRespondentIdentifier(event.target.value)}
              placeholder={t("administration.honestBroker.registerModal.respondentPlaceholder")}
              className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-ghost">
              {t("administration.honestBroker.labels.personId")}
            </div>
            <input
              type="number"
              min={1}
              step={1}
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
              placeholder={t("administration.honestBroker.registerModal.personIdPlaceholder")}
              className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none"
            />
          </label>
        </div>

        <label className="block">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-ghost">
            {t("administration.honestBroker.labels.notes")}
          </div>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t("administration.honestBroker.registerModal.notesPlaceholder")}
            className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}

function SendInvitationModal({
  open,
  campaign,
  links,
  isSending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  campaign: SurveyCampaignApi | null;
  links: HonestBrokerLinkApi[];
  isSending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    survey_honest_broker_link_id: number;
    delivery_email?: string | null;
    preferred_channel?: "email" | "sms";
  }) => void;
}) {
  const { t } = useTranslation("app");
  const [selectedLinkId, setSelectedLinkId] = useState<number | "">("");
  const [deliveryEmail, setDeliveryEmail] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const first = links[0];
    queueMicrotask(() => {
      setSelectedLinkId(first?.id ?? "");
      setDeliveryEmail(first?.contact?.delivery_email ?? "");
    });
  }, [open, campaign?.id, links]);

  const selectedLink = links.find((link) => link.id === selectedLinkId) ?? null;

  useEffect(() => {
    if (selectedLink != null) {
      queueMicrotask(() => {
        setDeliveryEmail(selectedLink.contact?.delivery_email ?? "");
      });
    }
  }, [selectedLink]);

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-muted hover:text-text-primary"
      >
        {t("administration.honestBroker.actions.cancel")}
      </button>
      <button
        type="button"
        disabled={isSending || selectedLink == null || deliveryEmail.trim().length === 0}
        onClick={() => {
          if (selectedLink == null) {
            return;
          }

          onSubmit({
            survey_honest_broker_link_id: selectedLink.id,
            delivery_email: deliveryEmail.trim(),
            preferred_channel: "email",
          });
        }}
        className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base disabled:opacity-50"
      >
        {isSending
          ? t("administration.honestBroker.inviteModal.sending")
          : t("administration.honestBroker.actions.sendInvitation")}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={campaign
        ? t("administration.honestBroker.inviteModal.titleWithCampaign", { campaign: campaign.name })
        : t("administration.honestBroker.inviteModal.title")}
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-muted">
          {t("administration.honestBroker.inviteModal.description")}
        </p>

        <label className="block">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-ghost">
            {t("administration.honestBroker.labels.participant")}
          </div>
          <select
            value={selectedLinkId}
            onChange={(event) => setSelectedLinkId(event.target.value ? Number(event.target.value) : "")}
            className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-success focus:outline-none"
          >
            <option value="">{t("administration.honestBroker.inviteModal.selectParticipant")}</option>
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                {link.person_id != null
                  ? t("administration.honestBroker.inviteModal.participantWithPerson", {
                      blindedId: link.blinded_participant_id,
                      personId: link.person_id,
                    })
                  : link.blinded_participant_id}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-ghost">
            {t("administration.honestBroker.labels.deliveryEmail")}
          </div>
          <input
            type="email"
            value={deliveryEmail}
            onChange={(event) => setDeliveryEmail(event.target.value)}
            placeholder={t("administration.honestBroker.inviteModal.emailPlaceholder")}
            className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none"
          />
        </label>

        {selectedLink?.latest_invitation && (
          <div className="rounded-lg border border-border-default bg-surface-base px-4 py-3 text-xs text-text-muted">
            {t("administration.honestBroker.inviteModal.lastInvitation", {
              status: t(`administration.honestBroker.deliveryStatuses.${selectedLink.latest_invitation.delivery_status.toLowerCase()}`, {
                defaultValue: selectedLink.latest_invitation.delivery_status,
              }),
              token: selectedLink.latest_invitation.token_last_four,
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

function UnauthorizedState() {
  const { t } = useTranslation("app");
  return (
    <div className="rounded-xl border border-critical/30 bg-critical/5 p-6">
      <div className="flex items-center gap-2 text-critical">
        <ShieldCheck size={16} />
        <h1 className="text-lg font-semibold">{t("administration.honestBroker.unauthorized.title")}</h1>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {t("administration.honestBroker.unauthorized.description")}
      </p>
    </div>
  );
}

export default function HonestBrokerPage() {
  const { t } = useTranslation("app");
  const hasAccess = useAuthStore((state) => state.hasRole(["data-steward", "admin", "super-admin"]));
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const campaignsQuery = useCampaigns({ per_page: 100 });
  const createLink = useCreateCampaignHonestBrokerLink();
  const sendInvitation = useSendCampaignHonestBrokerInvitation();
  const resendInvitation = useResendCampaignHonestBrokerInvitation();
  const revokeInvitation = useRevokeCampaignHonestBrokerInvitation();

  const brokerCampaigns = useMemo(
    () =>
      (campaignsQuery.data?.data ?? []).filter(
        (campaign) => campaign.requires_honest_broker,
      ),
    [campaignsQuery.data?.data],
  );

  const effectiveSelectedCampaignId =
    selectedCampaignId != null &&
    brokerCampaigns.some((campaign) => campaign.id === selectedCampaignId)
      ? selectedCampaignId
      : (brokerCampaigns[0]?.id ?? null);

  const selectedCampaign =
    brokerCampaigns.find((campaign) => campaign.id === effectiveSelectedCampaignId) ?? null;

  const linksQuery = useCampaignHonestBrokerLinks(effectiveSelectedCampaignId);
  const invitationsQuery = useCampaignHonestBrokerInvitations(effectiveSelectedCampaignId);
  const auditLogsQuery = useCampaignHonestBrokerAuditLogs(effectiveSelectedCampaignId);

  const currentLinks = useMemo(
    () => (effectiveSelectedCampaignId != null ? (linksQuery.data ?? []) : []),
    [effectiveSelectedCampaignId, linksQuery.data],
  );
  const currentInvitations = useMemo(
    () => (effectiveSelectedCampaignId != null ? (invitationsQuery.data ?? []) : []),
    [effectiveSelectedCampaignId, invitationsQuery.data],
  );
  const currentAuditLogs = useMemo(
    () => (effectiveSelectedCampaignId != null ? (auditLogsQuery.data ?? []) : []),
    [auditLogsQuery.data, effectiveSelectedCampaignId],
  );

  const filteredLinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const links = currentLinks;

    if (!term) {
      return links;
    }

    return links.filter((link) =>
      [
        String(link.person_id ?? ""),
        String(link.survey_conduct_id ?? ""),
        link.blinded_participant_id,
        link.match_status,
        link.notes ?? "",
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [currentLinks, search]);

  const submittedCount = currentLinks.filter((link) => link.submitted_at != null).length;
  const registeredCount = currentLinks.length;
  const sentInvitationCount = currentInvitations.filter((invitation) => invitation.sent_at != null).length;
  const selectedLink = filteredLinks[0] ?? null;
  const publishLink =
    selectedCampaign?.publish_token != null
      ? `${window.location.origin}/survey/${selectedCampaign.publish_token}`
      : null;
  const deliveryStatusLabel = (status: string) =>
    t(`administration.honestBroker.deliveryStatuses.${status.toLowerCase()}`, { defaultValue: status });
  const auditActionLabel = (action: string) =>
    t(`administration.honestBroker.auditActions.${action}`, { defaultValue: action.replace(/_/g, " ") });

  if (!hasAccess) {
    return <UnauthorizedState />;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-success" />
              <h1 className="text-2xl font-bold text-text-primary">
                {t("administration.honestBroker.title")}
              </h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">
              {t("administration.honestBroker.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => campaignsQuery.refetch()}
              className="rounded-lg border border-border-default px-3 py-2 text-sm text-text-muted hover:text-text-primary"
            >
              {t("administration.honestBroker.actions.refresh")}
            </button>
            <button
              type="button"
              disabled={selectedCampaign == null}
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base disabled:opacity-50"
            >
              <UserPlus size={15} />
              {t("administration.honestBroker.actions.registerParticipant")}
            </button>
            <button
              type="button"
              disabled={selectedCampaign == null || currentLinks.length === 0}
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              <Send size={15} />
              {t("administration.honestBroker.actions.sendInvite")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricTile
            label={t("administration.honestBroker.metrics.brokerCampaigns")}
            value={formatNumber(brokerCampaigns.length)}
            accent="var(--success)"
          />
          <MetricTile
            label={t("administration.honestBroker.metrics.registeredParticipants")}
            value={formatNumber(registeredCount)}
            accent="var(--info)"
          />
          <MetricTile
            label={t("administration.honestBroker.metrics.submitted")}
            value={formatNumber(submittedCount)}
            accent="var(--domain-observation)"
          />
          <MetricTile
            label={t("administration.honestBroker.metrics.invitationsSent")}
            value={formatNumber(sentInvitationCount)}
            accent="var(--accent)"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
          <section className="rounded-xl border border-border-default bg-surface-raised">
            <div className="border-b border-border-default px-5 py-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-success" />
                <h2 className="text-sm font-semibold text-text-primary">
                  {t("administration.honestBroker.campaignRegistry.title")}
                </h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {t("administration.honestBroker.campaignRegistry.subtitle")}
              </p>
            </div>

            <div className="max-h-[720px] space-y-3 overflow-y-auto p-4">
              {campaignsQuery.isLoading && (
                <div className="flex items-center justify-center py-10 text-sm text-text-muted">
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  {t("administration.honestBroker.campaignRegistry.loading")}
                </div>
              )}

              {!campaignsQuery.isLoading && brokerCampaigns.length === 0 && (
                <div className="rounded-lg border border-dashed border-border-default bg-surface-base p-4 text-sm text-text-muted">
                  {t("administration.honestBroker.campaignRegistry.emptyPrefix")}{" "}
                  <span className="text-text-primary">{t("administration.honestBroker.campaignRegistry.requireHonestBroker")}</span>{" "}
                  {t("administration.honestBroker.campaignRegistry.emptySuffix")}
                </div>
              )}

              {brokerCampaigns.map((campaign) => {
                const isSelected = campaign.id === effectiveSelectedCampaignId;

                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-success/50 bg-success/5"
                        : "border-border-default bg-surface-base hover:border-surface-highlight"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-primary">{campaign.name}</div>
                        <div className="mt-1 text-xs text-text-secondary">
                          {campaign.instrument?.abbreviation ?? t("administration.honestBroker.labels.unknown")}
                          {campaign.instrument?.name ? ` · ${campaign.instrument.name}` : ""}
                        </div>
                      </div>
                      <CampaignStatusBadge status={campaign.status} />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-surface-raised px-2 py-2">
                        <div className="text-sm font-semibold text-success">{formatNumber(campaign.stats?.complete ?? 0)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.metrics.complete")}
                        </div>
                      </div>
                      <div className="rounded-lg bg-surface-raised px-2 py-2">
                        <div className="text-sm font-semibold text-accent">{formatNumber(campaign.stats?.pending ?? 0)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.metrics.pending")}
                        </div>
                      </div>
                      <div className="rounded-lg bg-surface-raised px-2 py-2">
                        <div className="text-sm font-semibold text-info">{formatNumber(campaign.stats?.seeded_total ?? 0)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.metrics.seeded")}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-xl border border-border-default bg-surface-raised p-5">
              {selectedCampaign == null ? (
                <div className="text-sm text-text-muted">
                  {t("administration.honestBroker.messages.selectCampaignManage")}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-text-primary">{selectedCampaign.name}</h2>
                        <CampaignStatusBadge status={selectedCampaign.status} />
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {selectedCampaign.instrument?.abbreviation ?? t("administration.honestBroker.labels.unknownInstrument")}
                        {selectedCampaign.instrument?.name ? ` · ${selectedCampaign.instrument.name}` : ""}
                      </p>
                      {selectedCampaign.description && (
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">
                          {selectedCampaign.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {publishLink && (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(publishLink);
                                toast.success(t("administration.honestBroker.toasts.publishLinkCopied"));
                              } catch {
                                toast.error(t("administration.honestBroker.toasts.publishLinkCopyFailed"));
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary"
                          >
                            <Copy size={12} />
                            {t("administration.honestBroker.actions.copyLink")}
                          </button>
                          <a
                            href={publishLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary"
                          >
                            <ExternalLink size={12} />
                            {t("administration.honestBroker.actions.openSurvey")}
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-border-default bg-surface-base px-4 py-3">
                        <div className="text-xs font-semibold text-success">{formatNumber(registeredCount)}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.metrics.registered")}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border-default bg-surface-base px-4 py-3">
                      <div className="text-xs font-semibold text-domain-observation">{formatNumber(submittedCount)}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-text-ghost">
                        {t("administration.honestBroker.metrics.submitted")}
                      </div>
                      </div>
                      <div className="rounded-lg border border-border-default bg-surface-base px-4 py-3">
                      <div className="text-xs font-semibold text-info">{formatNumber(sentInvitationCount)}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-text-ghost">
                        {t("administration.honestBroker.metrics.invitationsSent")}
                      </div>
                      </div>
                    <div className="rounded-lg border border-border-default bg-surface-base px-4 py-3">
                      <div className="text-xs font-semibold text-accent">
                        {t("administration.honestBroker.metrics.completionPercent", {
                          value: formatNumber(selectedCampaign.stats?.completion_rate ?? 0),
                        })}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-text-ghost">
                        {t("administration.honestBroker.metrics.completion")}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-border-default bg-surface-raised">
              <div className="flex flex-col gap-4 border-b border-border-default px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t("administration.honestBroker.participants.title")}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {t("administration.honestBroker.participants.subtitle")}
                  </p>
                </div>

                <div className="relative w-full lg:w-80">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("administration.honestBroker.participants.searchPlaceholder")}
                    className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                {linksQuery.isLoading && effectiveSelectedCampaignId != null ? (
                  <div className="flex items-center justify-center py-16 text-sm text-text-muted">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    {t("administration.honestBroker.participants.loading")}
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="px-5 py-12 text-sm text-text-muted">
                    {selectedCampaign == null
                      ? t("administration.honestBroker.messages.selectCampaignReview")
                      : t("administration.honestBroker.participants.noMatches")}
                  </div>
                ) : (
                  <table className="w-full min-w-[980px]">
                    <thead className="bg-surface-base">
                      <tr>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.table.blindedParticipant")}
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.labels.personId")}
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.table.conductId")}
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.table.status")}
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.table.submitted")}
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.table.contact")}
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.table.latestInvite")}
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                          {t("administration.honestBroker.labels.notes")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.map((link: HonestBrokerLinkApi) => (
                        <tr key={link.id} className="border-t border-border-default">
                          <td className="px-5 py-3">
                            <div className="inline-flex items-center gap-2 rounded-lg bg-surface-base px-3 py-1.5 text-xs font-medium text-text-primary">
                              <CheckCircle2 size={12} className="text-success" />
                              {link.blinded_participant_id}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{link.person_id ?? "—"}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{link.survey_conduct_id ?? "—"}</td>
                          <td className="px-5 py-3">
                            <BrokerMatchBadge status={link.match_status} />
                          </td>
                          <td className="px-5 py-3 text-sm text-text-secondary">
                            {link.submitted_at
                              ? formatDateTime(link.submitted_at)
                              : t("administration.honestBroker.labels.notYet")}
                          </td>
                          <td className="px-5 py-3 text-sm text-text-secondary">
                            {link.contact?.delivery_email ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-sm text-text-secondary">
                            {link.latest_invitation
                              ? t("administration.honestBroker.labels.statusToken", {
                                  status: t(`administration.honestBroker.deliveryStatuses.${link.latest_invitation.delivery_status.toLowerCase()}`, {
                                    defaultValue: link.latest_invitation.delivery_status,
                                  }),
                                  token: link.latest_invitation.token_last_four,
                                })
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-sm text-text-muted">{link.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-raised">
              <div className="border-b border-border-default px-5 py-4">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-accent" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t("administration.honestBroker.invitations.title")}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {t("administration.honestBroker.invitations.subtitle")}
                </p>
              </div>

              <div className="overflow-x-auto">
                {invitationsQuery.isLoading && effectiveSelectedCampaignId != null ? (
                  <div className="flex items-center justify-center py-12 text-sm text-text-muted">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    {t("administration.honestBroker.invitations.loading")}
                  </div>
                ) : currentInvitations.length === 0 ? (
                  <div className="px-5 py-12 text-sm text-text-muted">
                    {t("administration.honestBroker.invitations.empty")}
                  </div>
                ) : (
                  <table className="w-full min-w-[980px]">
                    <thead className="bg-surface-base">
                      <tr>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.blindedParticipant")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.destination")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.status")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.sent")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.opened")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.submitted")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.reference")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentInvitations.map((invitation: HonestBrokerInvitationApi) => (
                        <tr key={invitation.id} className="border-t border-border-default">
                          <td className="px-5 py-3 text-sm text-text-primary">{invitation.link?.blinded_participant_id ?? "—"}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{invitation.contact?.delivery_email ?? "—"}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{deliveryStatusLabel(invitation.delivery_status)}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{invitation.sent_at ? formatDateTime(invitation.sent_at) : "—"}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{invitation.opened_at ? formatDateTime(invitation.opened_at) : "—"}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{invitation.submitted_at ? formatDateTime(invitation.submitted_at) : "—"}</td>
                          <td className="px-5 py-3 text-sm text-text-muted">{t("administration.honestBroker.labels.tokenReference", { token: invitation.token_last_four })}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={resendInvitation.isPending || invitation.submitted_at != null || invitation.revoked_at != null}
                                onClick={() => {
                                  if (selectedCampaign == null) return;
                                  resendInvitation.mutate(
                                    { campaignId: selectedCampaign.id, invitationId: invitation.id },
                                    {
                                      onSuccess: () => toast.success(t("administration.honestBroker.toasts.invitationResent", { token: invitation.token_last_four })),
                                      onError: () => toast.error(t("administration.honestBroker.toasts.invitationResendFailed")),
                                    },
                                  );
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-border-default px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                              >
                                <RotateCw size={12} />
                                {t("administration.honestBroker.actions.resend")}
                              </button>
                              <button
                                type="button"
                                disabled={revokeInvitation.isPending || invitation.submitted_at != null || invitation.revoked_at != null}
                                onClick={() => {
                                  if (selectedCampaign == null) return;
                                  const confirmed = window.confirm(t("administration.honestBroker.confirmRevoke", { token: invitation.token_last_four }));
                                  if (!confirmed) return;
                                  revokeInvitation.mutate(
                                    { campaignId: selectedCampaign.id, invitationId: invitation.id },
                                    {
                                      onSuccess: () => toast.success(t("administration.honestBroker.toasts.invitationRevoked", { token: invitation.token_last_four })),
                                      onError: () => toast.error(t("administration.honestBroker.toasts.invitationRevokeFailed")),
                                    },
                                  );
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-critical/30 px-2.5 py-1.5 text-xs text-critical hover:bg-critical/10 disabled:opacity-50"
                              >
                                <Ban size={12} />
                                {t("administration.honestBroker.actions.revoke")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-raised">
              <div className="border-b border-border-default px-5 py-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-info" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t("administration.honestBroker.audit.title")}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {t("administration.honestBroker.audit.subtitle")}
                </p>
              </div>

              <div className="overflow-x-auto">
                {auditLogsQuery.isLoading && effectiveSelectedCampaignId != null ? (
                  <div className="flex items-center justify-center py-12 text-sm text-text-muted">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    {t("administration.honestBroker.audit.loading")}
                  </div>
                ) : currentAuditLogs.length === 0 ? (
                  <div className="px-5 py-12 text-sm text-text-muted">
                    {t("administration.honestBroker.audit.empty")}
                  </div>
                ) : (
                  <table className="w-full min-w-[980px]">
                    <thead className="bg-surface-base">
                      <tr>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.time")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.action")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.actor")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.labels.participant")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.inviteRef")}</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">{t("administration.honestBroker.table.metadata")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentAuditLogs.map((entry: HonestBrokerAuditLogApi) => (
                        <tr key={entry.id} className="border-t border-border-default">
                          <td className="px-5 py-3 text-sm text-text-secondary">{formatDateTime(entry.occurred_at)}</td>
                          <td className="px-5 py-3 text-sm text-text-primary">{auditActionLabel(entry.action)}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{entry.actor?.name ?? t("administration.honestBroker.labels.system")}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{entry.link?.blinded_participant_id ?? "—"}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">
                            {entry.invitation?.token_last_four
                              ? t("administration.honestBroker.labels.tokenReference", { token: entry.invitation.token_last_four })
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-xs text-text-muted font-mono">
                            {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {selectedLink && (
              <div className="rounded-xl border border-border-default bg-surface-raised p-5">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t("administration.honestBroker.latest.title")}
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-surface-base px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-text-ghost">
                      {t("administration.honestBroker.latest.blindedId")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">{selectedLink.blinded_participant_id}</div>
                  </div>
                  <div className="rounded-lg bg-surface-base px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-text-ghost">
                      {t("administration.honestBroker.labels.personId")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">{selectedLink.person_id ?? "—"}</div>
                  </div>
                  <div className="rounded-lg bg-surface-base px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-text-ghost">
                      {t("administration.honestBroker.latest.created")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {formatDateTime(selectedLink.created_at)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-base px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-text-ghost">
                      {t("administration.honestBroker.labels.deliveryEmail")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {selectedLink.contact?.delivery_email ?? t("administration.honestBroker.labels.notRecorded")}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <RegisterParticipantModal
        open={showRegisterModal}
        campaign={selectedCampaign}
        isSaving={createLink.isPending}
        onClose={() => setShowRegisterModal(false)}
        onSubmit={(payload) => {
          if (selectedCampaign == null) {
            return;
          }

          createLink.mutate(
            {
              campaignId: selectedCampaign.id,
              payload,
            },
            {
              onSuccess: () => {
                setShowRegisterModal(false);
                toast.success(t("administration.honestBroker.toasts.participantRegistered"));
              },
              onError: () => {
                toast.error(t("administration.honestBroker.toasts.participantRegisterFailed"));
              },
            },
          );
        }}
      />

      <SendInvitationModal
        open={showInviteModal}
        campaign={selectedCampaign}
        links={currentLinks}
        isSending={sendInvitation.isPending}
        onClose={() => setShowInviteModal(false)}
        onSubmit={(payload) => {
          if (selectedCampaign == null) {
            return;
          }

          sendInvitation.mutate(
            {
              campaignId: selectedCampaign.id,
              payload,
            },
            {
              onSuccess: (result) => {
                setShowInviteModal(false);
                toast.success(t("administration.honestBroker.toasts.invitationSent", { token: result.invitation.token_last_four }));
              },
              onError: () => {
                toast.error(t("administration.honestBroker.toasts.invitationSendFailed"));
              },
            },
          );
        }}
      />
    </>
  );
}
