import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateCampaign,
  closeCampaign,
  createCampaignHonestBrokerLink,
  createCampaign,
  deleteCampaign,
  fetchCampaign,
  fetchCampaignHonestBrokerAuditLogs,
  fetchCampaignConductRecords,
  fetchCampaignHonestBrokerLinks,
  fetchCampaignHonestBrokerInvitations,
  fetchCampaigns,
  importCampaignResponses,
  resendCampaignHonestBrokerInvitation,
  revokeCampaignHonestBrokerInvitation,
  sendCampaignHonestBrokerInvitation,
  storeConductResponses,
  upsertCampaignHonestBrokerContact,
  updateCampaign,
  type StoreCampaignPayload,
} from "../api/campaignApi";

const CAMPAIGN_KEYS = {
  all: ["survey-campaigns"] as const,
  list: (params?: Record<string, unknown>) =>
    [...CAMPAIGN_KEYS.all, "list", params] as const,
  detail: (id: number) => [...CAMPAIGN_KEYS.all, "detail", id] as const,
};

export function useCampaigns(params?: {
  status?: "draft" | "active" | "closed";
  per_page?: number;
}) {
  return useQuery({
    queryKey: CAMPAIGN_KEYS.list(params as Record<string, unknown>),
    queryFn: () => fetchCampaigns(params),
  });
}

export function useCampaign(id: number | null) {
  return useQuery({
    queryKey: CAMPAIGN_KEYS.detail(id ?? 0),
    queryFn: () => fetchCampaign(id!),
    enabled: id != null && id > 0,
  });
}

export function useCampaignConductRecords(
  campaignId: number | null,
  params?: { status?: string },
) {
  return useQuery({
    queryKey: [...CAMPAIGN_KEYS.all, "conduct-records", campaignId, params] as const,
    queryFn: () => fetchCampaignConductRecords(campaignId!, params),
    enabled: campaignId != null && campaignId > 0,
  });
}

export function useCampaignHonestBrokerLinks(campaignId: number | null) {
  return useQuery({
    queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-links", campaignId] as const,
    queryFn: () => fetchCampaignHonestBrokerLinks(campaignId!),
    enabled: campaignId != null && campaignId > 0,
  });
}

export function useCampaignHonestBrokerInvitations(campaignId: number | null) {
  return useQuery({
    queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-invitations", campaignId] as const,
    queryFn: () => fetchCampaignHonestBrokerInvitations(campaignId!),
    enabled: campaignId != null && campaignId > 0,
  });
}

export function useCampaignHonestBrokerAuditLogs(campaignId: number | null) {
  return useQuery({
    queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-audit-logs", campaignId] as const,
    queryFn: () => fetchCampaignHonestBrokerAuditLogs(campaignId!),
    enabled: campaignId != null && campaignId > 0,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StoreCampaignPayload) => createCampaign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.all });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StoreCampaignPayload }) =>
      updateCampaign(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.detail(variables.id) });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.all });
    },
  });
}

export function useActivateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => activateCampaign(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.detail(data.id) });
    },
  });
}

export function useCloseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => closeCampaign(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.detail(data.id) });
    },
  });
}

export function useImportCampaignResponses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, csv }: { id: number; csv: string }) =>
      importCampaignResponses(id, csv),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "conduct-records", variables.id] });
    },
  });
}

export function useStoreConductResponses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conductId,
      responses,
    }: {
      conductId: number;
      campaignId: number;
      responses: Array<{ survey_item_id: number; value: string | number | string[] }>;
    }) => storeConductResponses(conductId, responses),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.detail(variables.campaignId) });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "conduct-records", variables.campaignId] });
    },
  });
}

export function useCreateCampaignHonestBrokerLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      payload,
    }: {
      campaignId: number;
      payload: {
        respondent_identifier: string;
        person_id?: number | null;
        notes?: string | null;
      };
    }) => createCampaignHonestBrokerLink(campaignId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.detail(variables.campaignId) });
      queryClient.invalidateQueries({
        queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-links", variables.campaignId],
      });
      queryClient.invalidateQueries({
        queryKey: [...CAMPAIGN_KEYS.all, "conduct-records", variables.campaignId],
      });
    },
  });
}

export function useUpsertCampaignHonestBrokerContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      linkId,
      payload,
    }: {
      campaignId: number;
      linkId: number;
      payload: {
        delivery_email?: string | null;
        delivery_phone?: string | null;
        preferred_channel?: "email" | "sms";
      };
    }) => upsertCampaignHonestBrokerContact(campaignId, linkId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-links", variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-invitations", variables.campaignId] });
    },
  });
}

export function useSendCampaignHonestBrokerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      payload,
    }: {
      campaignId: number;
      payload: {
        survey_honest_broker_link_id: number;
        delivery_email?: string | null;
        delivery_phone?: string | null;
        preferred_channel?: "email" | "sms";
      };
    }) => sendCampaignHonestBrokerInvitation(campaignId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-links", variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-invitations", variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: CAMPAIGN_KEYS.detail(variables.campaignId) });
    },
  });
}

export function useResendCampaignHonestBrokerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      invitationId,
    }: {
      campaignId: number;
      invitationId: number;
    }) => resendCampaignHonestBrokerInvitation(campaignId, invitationId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-links", variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-invitations", variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-audit-logs", variables.campaignId] });
    },
  });
}

export function useRevokeCampaignHonestBrokerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      invitationId,
    }: {
      campaignId: number;
      invitationId: number;
    }) => revokeCampaignHonestBrokerInvitation(campaignId, invitationId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-links", variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-invitations", variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGN_KEYS.all, "honest-broker-audit-logs", variables.campaignId] });
    },
  });
}
