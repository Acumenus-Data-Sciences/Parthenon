import apiClient from "@/lib/api-client";
import type { RadiogenomicsPanel, VariantDrugInteraction } from "../types";

export const radiogenomicsApi = {
  getPatientPanel: (personId: number, sourceId?: number) =>
    apiClient
      .get<{ data: RadiogenomicsPanel }>(`/radiogenomics/patients/${personId}`, {
        params: sourceId ? { source_id: sourceId } : undefined,
      })
      .then((r: { data: { data: RadiogenomicsPanel } }) => r.data.data),

  getVariantDrugInteractions: (params?: { gene?: string; drug?: string; relationship?: string }) =>
    apiClient
      .get<{ data: VariantDrugInteraction[] }>("/radiogenomics/variant-drug-interactions", { params })
      .then((r: { data: { data: VariantDrugInteraction[] } }) => r.data.data),
};
