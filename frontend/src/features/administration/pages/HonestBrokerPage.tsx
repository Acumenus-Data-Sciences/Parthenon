import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Mail, RotateCw, Send, ShieldCheck, UserPlus, Users, Search, ExternalLink, CheckCircle2, Ban } from "lucide-react";
import { Modal, toast } from "@/components/ui";
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
  const className = {
    draft: "bg-[#C9A227]/10 text-[#C9A227]",
    active: "bg-[#2DD4BF]/10 text-[#2DD4BF]",
    closed: "bg-[#E85A6B]/10 text-[#E85A6B]",
  }[status];

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${className}`}>
      {status}
    </span>
  );
}

function BrokerMatchBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized === "submitted"
      ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
      : normalized === "registered"
        ? "bg-[#60A5FA]/10 text-[#60A5FA]"
        : "bg-[#C9A227]/10 text-[#C9A227]";

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${className}`}>
      {status}
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
    <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-4">
      <div className="text-lg font-semibold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-[#5A5650]">{label}</div>
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
  const [respondentIdentifier, setRespondentIdentifier] = useState("");
  const [personId, setPersonId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setRespondentIdentifier("");
    setPersonId("");
    setNotes("");
  }, [open, campaign?.id]);

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
      >
        Cancel
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
        className="rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:opacity-50"
      >
        {isSaving ? "Registering..." : "Register Participant"}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={campaign ? `Register Participant · ${campaign.name}` : "Register Participant"}
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[#8A857D]">
          Create a blinded registry entry that maps a respondent identifier to a patient record for this survey campaign.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5A5650]">
              Respondent Identifier
            </div>
            <input
              type="text"
              value={respondentIdentifier}
              onChange={(event) => setRespondentIdentifier(event.target.value)}
              placeholder="MRN, study code, or invite code"
              className="w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5A5650]">
              Person ID
            </div>
            <input
              type="number"
              min={1}
              step={1}
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
              placeholder="Known OMOP person_id"
              className="w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none"
            />
          </label>
        </div>

        <label className="block">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5A5650]">Notes</div>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional broker notes"
            className="w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none"
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
  const [selectedLinkId, setSelectedLinkId] = useState<number | "">("");
  const [deliveryEmail, setDeliveryEmail] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const first = links[0];
    setSelectedLinkId(first?.id ?? "");
    setDeliveryEmail(first?.contact?.delivery_email ?? "");
  }, [open, campaign?.id, links]);

  const selectedLink = links.find((link) => link.id === selectedLinkId) ?? null;

  useEffect(() => {
    if (selectedLink != null) {
      setDeliveryEmail(selectedLink.contact?.delivery_email ?? "");
    }
  }, [selectedLink]);

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
      >
        Cancel
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
        className="rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:opacity-50"
      >
        {isSending ? "Sending..." : "Send Invitation"}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={campaign ? `Send Invitation · ${campaign.name}` : "Send Invitation"}
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[#8A857D]">
          Send a one-time broker-managed survey link. Only the broker retains the delivery address and chain of custody.
        </p>

        <label className="block">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5A5650]">
            Participant
          </div>
          <select
            value={selectedLinkId}
            onChange={(event) => setSelectedLinkId(event.target.value ? Number(event.target.value) : "")}
            className="w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#2DD4BF] focus:outline-none"
          >
            <option value="">Select participant</option>
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                {link.blinded_participant_id} {link.person_id != null ? `· person ${link.person_id}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5A5650]">
            Delivery Email
          </div>
          <input
            type="email"
            value={deliveryEmail}
            onChange={(event) => setDeliveryEmail(event.target.value)}
            placeholder="patient@example.org"
            className="w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none"
          />
        </label>

        {selectedLink?.latest_invitation && (
          <div className="rounded-lg border border-[#2A2A2F] bg-[#101014] px-4 py-3 text-xs text-[#8A857D]">
            Last invitation: <span className="text-[#F0EDE8]">{selectedLink.latest_invitation.delivery_status}</span>
            {" · "}token ending {selectedLink.latest_invitation.token_last_four}
          </div>
        )}
      </div>
    </Modal>
  );
}

function UnauthorizedState() {
  return (
    <div className="rounded-xl border border-[#E85A6B]/30 bg-[#E85A6B]/5 p-6">
      <div className="flex items-center gap-2 text-[#E85A6B]">
        <ShieldCheck size={16} />
        <h1 className="text-lg font-semibold">Honest Broker Access Required</h1>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[#C5C0B8]">
        This workspace is restricted to data stewards and administrators because it links blinded survey identities to patient records.
      </p>
    </div>
  );
}

export default function HonestBrokerPage() {
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

  useEffect(() => {
    if (brokerCampaigns.length === 0) {
      setSelectedCampaignId(null);
      return;
    }

    if (selectedCampaignId == null || !brokerCampaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(brokerCampaigns[0].id);
    }
  }, [brokerCampaigns, selectedCampaignId]);

  const selectedCampaign =
    brokerCampaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;

  const linksQuery = useCampaignHonestBrokerLinks(selectedCampaignId);
  const invitationsQuery = useCampaignHonestBrokerInvitations(selectedCampaignId);
  const auditLogsQuery = useCampaignHonestBrokerAuditLogs(selectedCampaignId);

  const currentLinks = selectedCampaignId != null ? (linksQuery.data ?? []) : [];
  const currentInvitations = selectedCampaignId != null ? (invitationsQuery.data ?? []) : [];
  const currentAuditLogs = selectedCampaignId != null ? (auditLogsQuery.data ?? []) : [];

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

  if (!hasAccess) {
    return <UnauthorizedState />;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#2DD4BF]" />
              <h1 className="text-2xl font-bold text-[#F0EDE8]">Honest Broker</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#8A857D]">
              Register blinded survey participants, link them to OMOP `person_id` records, and monitor submission status without exposing raw respondent identities to researchers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => campaignsQuery.refetch()}
              className="rounded-lg border border-[#2A2A2F] px-3 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={selectedCampaign == null}
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:opacity-50"
            >
              <UserPlus size={15} />
              Register Participant
            </button>
            <button
              type="button"
              disabled={selectedCampaign == null || currentLinks.length === 0}
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm font-medium text-[#C5C0B8] hover:text-[#F0EDE8] disabled:opacity-50"
            >
              <Send size={15} />
              Send Invite
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricTile label="Broker Campaigns" value={brokerCampaigns.length} accent="#2DD4BF" />
          <MetricTile label="Registered Participants" value={registeredCount} accent="#60A5FA" />
          <MetricTile label="Submitted" value={submittedCount} accent="#A78BFA" />
          <MetricTile label="Invitations Sent" value={sentInvitationCount} accent="#C9A227" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
          <section className="rounded-xl border border-[#2A2A2F] bg-[#141418]">
            <div className="border-b border-[#232328] px-5 py-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#2DD4BF]" />
                <h2 className="text-sm font-semibold text-[#F0EDE8]">Campaign Registry</h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#8A857D]">
                Honest-broker-enabled campaigns only.
              </p>
            </div>

            <div className="max-h-[720px] space-y-3 overflow-y-auto p-4">
              {campaignsQuery.isLoading && (
                <div className="flex items-center justify-center py-10 text-sm text-[#8A857D]">
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Loading campaigns...
                </div>
              )}

              {!campaignsQuery.isLoading && brokerCampaigns.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#2A2A2F] bg-[#101014] p-4 text-sm text-[#8A857D]">
                  No honest-broker campaigns yet. Enable <span className="text-[#F0EDE8]">Require Honest Broker</span> on a survey campaign first.
                </div>
              )}

              {brokerCampaigns.map((campaign) => {
                const isSelected = campaign.id === selectedCampaignId;

                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/5"
                        : "border-[#232328] bg-[#101014] hover:border-[#3A3A42]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#F0EDE8]">{campaign.name}</div>
                        <div className="mt-1 text-xs text-[#C5C0B8]">
                          {campaign.instrument?.abbreviation ?? "Unknown"}{campaign.instrument?.name ? ` · ${campaign.instrument.name}` : ""}
                        </div>
                      </div>
                      <CampaignStatusBadge status={campaign.status} />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-[#151518] px-2 py-2">
                        <div className="text-sm font-semibold text-[#2DD4BF]">{campaign.stats?.complete ?? 0}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">Complete</div>
                      </div>
                      <div className="rounded-lg bg-[#151518] px-2 py-2">
                        <div className="text-sm font-semibold text-[#C9A227]">{campaign.stats?.pending ?? 0}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">Pending</div>
                      </div>
                      <div className="rounded-lg bg-[#151518] px-2 py-2">
                        <div className="text-sm font-semibold text-[#60A5FA]">{campaign.stats?.seeded_total ?? 0}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">Seeded</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
              {selectedCampaign == null ? (
                <div className="text-sm text-[#8A857D]">Select a campaign to manage broker registrations.</div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-[#F0EDE8]">{selectedCampaign.name}</h2>
                        <CampaignStatusBadge status={selectedCampaign.status} />
                      </div>
                      <p className="mt-1 text-sm text-[#C5C0B8]">
                        {selectedCampaign.instrument?.abbreviation ?? "Unknown instrument"}
                        {selectedCampaign.instrument?.name ? ` · ${selectedCampaign.instrument.name}` : ""}
                      </p>
                      {selectedCampaign.description && (
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#8A857D]">
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
                                toast.success("Publish link copied");
                              } catch {
                                toast.error("Failed to copy publish link");
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8]"
                          >
                            <Copy size={12} />
                            Copy Link
                          </button>
                          <a
                            href={publishLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8]"
                          >
                            <ExternalLink size={12} />
                            Open Survey
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-[#2A2A2F] bg-[#101014] px-4 py-3">
                        <div className="text-xs font-semibold text-[#2DD4BF]">{registeredCount}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-[#5A5650]">Registered</div>
                      </div>
                      <div className="rounded-lg border border-[#2A2A2F] bg-[#101014] px-4 py-3">
                      <div className="text-xs font-semibold text-[#A78BFA]">{submittedCount}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-[#5A5650]">Submitted</div>
                      </div>
                      <div className="rounded-lg border border-[#2A2A2F] bg-[#101014] px-4 py-3">
                      <div className="text-xs font-semibold text-[#60A5FA]">{sentInvitationCount}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-[#5A5650]">Invitations Sent</div>
                      </div>
                    <div className="rounded-lg border border-[#2A2A2F] bg-[#101014] px-4 py-3">
                      <div className="text-xs font-semibold text-[#C9A227]">
                        {selectedCampaign.stats?.completion_rate ?? 0}%
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-[#5A5650]">Completion</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-[#2A2A2F] bg-[#141418]">
              <div className="flex flex-col gap-4 border-b border-[#232328] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#F0EDE8]">Registered Participants</h3>
                  <p className="mt-1 text-xs text-[#8A857D]">
                    De-identified registry entries for the selected survey campaign.
                  </p>
                </div>

                <div className="relative w-full lg:w-80">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search blinded id, person id, notes..."
                    className="w-full rounded-lg border border-[#232328] bg-[#151518] py-2 pl-9 pr-3 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                {linksQuery.isLoading && selectedCampaignId != null ? (
                  <div className="flex items-center justify-center py-16 text-sm text-[#8A857D]">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Loading registrations...
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="px-5 py-12 text-sm text-[#8A857D]">
                    {selectedCampaign == null
                      ? "Select a campaign to review broker registrations."
                      : "No broker registrations match the current filter."}
                  </div>
                ) : (
                  <table className="w-full min-w-[980px]">
                    <thead className="bg-[#101014]">
                      <tr>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                          Blinded Participant
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                          Person ID
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                          Conduct ID
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                          Status
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                          Submitted
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                          Contact
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                          Latest Invite
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.map((link: HonestBrokerLinkApi) => (
                        <tr key={link.id} className="border-t border-[#232328]">
                          <td className="px-5 py-3">
                            <div className="inline-flex items-center gap-2 rounded-lg bg-[#101014] px-3 py-1.5 text-xs font-medium text-[#F0EDE8]">
                              <CheckCircle2 size={12} className="text-[#2DD4BF]" />
                              {link.blinded_participant_id}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{link.person_id ?? "—"}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{link.survey_conduct_id ?? "—"}</td>
                          <td className="px-5 py-3">
                            <BrokerMatchBadge status={link.match_status} />
                          </td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">
                            {link.submitted_at ? new Date(link.submitted_at).toLocaleString() : "Not yet"}
                          </td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">
                            {link.contact?.delivery_email ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">
                            {link.latest_invitation
                              ? `${link.latest_invitation.delivery_status} · ${link.latest_invitation.token_last_four}`
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-sm text-[#8A857D]">{link.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#2A2A2F] bg-[#141418]">
              <div className="border-b border-[#232328] px-5 py-4">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-[#C9A227]" />
                  <h3 className="text-sm font-semibold text-[#F0EDE8]">Invitation Ledger</h3>
                </div>
                <p className="mt-1 text-xs text-[#8A857D]">
                  Outbound and inbound chain of custody for broker-managed survey invitations.
                </p>
              </div>

              <div className="overflow-x-auto">
                {invitationsQuery.isLoading && selectedCampaignId != null ? (
                  <div className="flex items-center justify-center py-12 text-sm text-[#8A857D]">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Loading invitations...
                  </div>
                ) : currentInvitations.length === 0 ? (
                  <div className="px-5 py-12 text-sm text-[#8A857D]">
                    No invitations sent for this campaign yet.
                  </div>
                ) : (
                  <table className="w-full min-w-[980px]">
                    <thead className="bg-[#101014]">
                      <tr>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Blinded Participant</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Destination</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Status</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Sent</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Opened</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Submitted</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Reference</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentInvitations.map((invitation: HonestBrokerInvitationApi) => (
                        <tr key={invitation.id} className="border-t border-[#232328]">
                          <td className="px-5 py-3 text-sm text-[#F0EDE8]">{invitation.link?.blinded_participant_id ?? "—"}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{invitation.contact?.delivery_email ?? "—"}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{invitation.delivery_status}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{invitation.sent_at ? new Date(invitation.sent_at).toLocaleString() : "—"}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{invitation.opened_at ? new Date(invitation.opened_at).toLocaleString() : "—"}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{invitation.submitted_at ? new Date(invitation.submitted_at).toLocaleString() : "—"}</td>
                          <td className="px-5 py-3 text-sm text-[#8A857D]">…{invitation.token_last_four}</td>
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
                                      onSuccess: () => toast.success(`Invitation resent · token ending ${invitation.token_last_four}`),
                                      onError: () => toast.error("Failed to resend invitation"),
                                    },
                                  );
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A2F] px-2.5 py-1.5 text-xs text-[#C5C0B8] hover:text-[#F0EDE8] disabled:opacity-50"
                              >
                                <RotateCw size={12} />
                                Resend
                              </button>
                              <button
                                type="button"
                                disabled={revokeInvitation.isPending || invitation.submitted_at != null || invitation.revoked_at != null}
                                onClick={() => {
                                  if (selectedCampaign == null) return;
                                  const confirmed = window.confirm(`Revoke invitation ending ${invitation.token_last_four}?`);
                                  if (!confirmed) return;
                                  revokeInvitation.mutate(
                                    { campaignId: selectedCampaign.id, invitationId: invitation.id },
                                    {
                                      onSuccess: () => toast.success(`Invitation revoked · token ending ${invitation.token_last_four}`),
                                      onError: () => toast.error("Failed to revoke invitation"),
                                    },
                                  );
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E85A6B]/30 px-2.5 py-1.5 text-xs text-[#E85A6B] hover:bg-[#E85A6B]/10 disabled:opacity-50"
                              >
                                <Ban size={12} />
                                Revoke
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

            <div className="rounded-xl border border-[#2A2A2F] bg-[#141418]">
              <div className="border-b border-[#232328] px-5 py-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#60A5FA]" />
                  <h3 className="text-sm font-semibold text-[#F0EDE8]">Audit Trail</h3>
                </div>
                <p className="mt-1 text-xs text-[#8A857D]">
                  Immutable broker-side chain of custody for participant registration, outbound invites, and inbound response events.
                </p>
              </div>

              <div className="overflow-x-auto">
                {auditLogsQuery.isLoading && selectedCampaignId != null ? (
                  <div className="flex items-center justify-center py-12 text-sm text-[#8A857D]">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Loading audit trail...
                  </div>
                ) : currentAuditLogs.length === 0 ? (
                  <div className="px-5 py-12 text-sm text-[#8A857D]">
                    No broker audit events recorded yet.
                  </div>
                ) : (
                  <table className="w-full min-w-[980px]">
                    <thead className="bg-[#101014]">
                      <tr>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Time</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Action</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Actor</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Participant</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Invite Ref</th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentAuditLogs.map((entry: HonestBrokerAuditLogApi) => (
                        <tr key={entry.id} className="border-t border-[#232328]">
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{new Date(entry.occurred_at).toLocaleString()}</td>
                          <td className="px-5 py-3 text-sm text-[#F0EDE8]">{entry.action.replace(/_/g, " ")}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{entry.actor?.name ?? "System"}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{entry.link?.blinded_participant_id ?? "—"}</td>
                          <td className="px-5 py-3 text-sm text-[#C5C0B8]">{entry.invitation?.token_last_four ? `…${entry.invitation.token_last_four}` : "—"}</td>
                          <td className="px-5 py-3 text-xs text-[#8A857D] font-mono">
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
              <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
                <h3 className="text-sm font-semibold text-[#F0EDE8]">Latest Matching Record</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-[#101014] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">Blinded ID</div>
                    <div className="mt-1 text-sm font-medium text-[#F0EDE8]">{selectedLink.blinded_participant_id}</div>
                  </div>
                  <div className="rounded-lg bg-[#101014] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">Person ID</div>
                    <div className="mt-1 text-sm font-medium text-[#F0EDE8]">{selectedLink.person_id ?? "—"}</div>
                  </div>
                  <div className="rounded-lg bg-[#101014] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">Created</div>
                    <div className="mt-1 text-sm font-medium text-[#F0EDE8]">
                      {new Date(selectedLink.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#101014] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">Delivery Email</div>
                    <div className="mt-1 text-sm font-medium text-[#F0EDE8]">
                      {selectedLink.contact?.delivery_email ?? "Not recorded"}
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
                toast.success("Participant registered");
              },
              onError: () => {
                toast.error("Failed to register participant");
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
                toast.success(`Invitation sent · token ending ${result.invitation.token_last_four}`);
              },
              onError: () => {
                toast.error("Failed to send invitation");
              },
            },
          );
        }}
      />
    </>
  );
}
