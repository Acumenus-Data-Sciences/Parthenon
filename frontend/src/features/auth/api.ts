import { useQuery, useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { AuthResponse } from "@/types/api";

export interface AuthProviders {
  oidc_enabled: boolean;
  oidc_label: string;
  oidc_redirect_path: string;
}

async function fetchAuthProviders(): Promise<AuthProviders> {
  const { data } = await apiClient.get<AuthProviders>("/auth/providers");
  return data;
}

export function useAuthProviders() {
  return useQuery({
    queryKey: ["auth", "providers"],
    queryFn: fetchAuthProviders,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

async function exchangeOidcCode(code: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/oidc/exchange", {
    code,
  });
  return data;
}

export function useExchangeOidcCode() {
  return useMutation({ mutationFn: exchangeOidcCode });
}
