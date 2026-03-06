import { useMutation, useQuery } from "@tanstack/react-query";
import {
  testAtlasConnection,
  discoverAtlasEntities,
  startAtlasMigration,
  fetchMigrationStatus,
  fetchMigrationHistory,
  retryMigration,
} from "../api/migrationApi";

export function useTestAtlasConnection() {
  return useMutation({ mutationFn: testAtlasConnection });
}

export function useDiscoverAtlasEntities() {
  return useMutation({ mutationFn: discoverAtlasEntities });
}

export function useStartAtlasMigration() {
  return useMutation({ mutationFn: startAtlasMigration });
}

export function useMigrationStatus(id: number | null, refetchInterval?: number) {
  return useQuery({
    queryKey: ["atlas-migration-status", id],
    queryFn: () => fetchMigrationStatus(id!),
    enabled: id !== null,
    refetchInterval: refetchInterval ?? false,
  });
}

export function useMigrationHistory() {
  return useQuery({
    queryKey: ["atlas-migration-history"],
    queryFn: fetchMigrationHistory,
  });
}

export function useRetryMigration() {
  return useMutation({ mutationFn: retryMigration });
}
