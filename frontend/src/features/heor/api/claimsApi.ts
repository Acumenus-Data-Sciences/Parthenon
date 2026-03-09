import apiClient from "@/lib/api-client";

export interface ClaimItem {
  claim_id: string;
  patient_id: number;
  patient_name: string;
  provider_id: number;
  service_date: string;
  last_billed_date: string;
  diagnosis_codes: string[];
  diagnosis_names: string[];
  claim_status: string;
  claim_type: string;
  total_charge: number;
  total_payment: number;
  total_adjustment: number;
  outstanding: number;
  transaction_count: number;
  procedure_codes: string[];
  place_of_service: string;
  department_id: number;
  appointment_id: string;
}

export interface ClaimStats {
  min: number;
  max: number;
  sum: number;
  mean: number;
  count: number;
}

export interface ClaimsSearchResult {
  items: ClaimItem[];
  total: number;
  facets: Record<string, Record<string, number>>;
  stats: Record<string, ClaimStats>;
  engine: string;
}

export interface ClaimsSearchFilters {
  q?: string;
  patient_id?: number;
  status?: string;
  type?: string;
  place_of_service?: string;
  diagnosis?: string;
  date_from?: string;
  date_to?: string;
  min_charge?: number;
  max_charge?: number;
  has_outstanding?: boolean;
  limit?: number;
  offset?: number;
}

export const claimsApi = {
  search: (filters: ClaimsSearchFilters = {}) =>
    apiClient
      .get<{ data: ClaimsSearchResult }>("/claims/search", { params: filters })
      .then((r) => r.data.data),
};
