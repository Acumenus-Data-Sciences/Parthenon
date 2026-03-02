import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAuthProviders,
  fetchAuthProvider,
  updateAuthProvider,
  enableAuthProvider,
  disableAuthProvider,
  testAuthProvider,
} from "../api/adminApi";
import type { AuthProviderSetting } from "@/types/models";

export const useAuthProviders = () =>
  useQuery({ queryKey: ["admin", "auth-providers"], queryFn: fetchAuthProviders });

export const useAuthProvider = (type: string) =>
  useQuery({
    queryKey: ["admin", "auth-providers", type],
    queryFn: () => fetchAuthProvider(type),
    enabled: !!type,
  });

export const useUpdateAuthProvider = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, data }: { type: string; data: Partial<AuthProviderSetting> }) =>
      updateAuthProvider(type, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "auth-providers"] }),
  });
};

export const useToggleAuthProvider = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, enable }: { type: string; enable: boolean }) =>
      enable ? enableAuthProvider(type) : disableAuthProvider(type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "auth-providers"] }),
  });
};

export const useTestAuthProvider = () =>
  useMutation({ mutationFn: testAuthProvider });
