import { useQuery } from "@tanstack/react-query";
import {
  fetchAuditLog,
  fetchAuditSummary,
  fetchUserAuditLog,
  type AuditFilters,
} from "../api/adminApi";

export const useAuditLog = (filters: AuditFilters = {}) =>
  useQuery({
    queryKey: ["admin", "user-audit", filters],
    queryFn: () => fetchAuditLog(filters),
    staleTime: 30_000,
  });

export const useAuditSummary = () =>
  useQuery({
    queryKey: ["admin", "user-audit", "summary"],
    queryFn: fetchAuditSummary,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

export const useUserAuditLog = (userId: number, params?: { per_page?: number; page?: number }) =>
  useQuery({
    queryKey: ["admin", "user-audit", "user", userId, params],
    queryFn: () => fetchUserAuditLog(userId, params),
    enabled: userId > 0,
    staleTime: 30_000,
  });
