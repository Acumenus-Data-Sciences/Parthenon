import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchRoles,
  fetchRole,
  fetchPermissions,
  createRole,
  updateRole,
  deleteRole,
} from "../api/adminApi";

export const useRoles = () =>
  useQuery({ queryKey: ["admin", "roles"], queryFn: fetchRoles });

export const useRole = (id: number) =>
  useQuery({
    queryKey: ["admin", "roles", id],
    queryFn: () => fetchRole(id),
    enabled: id > 0,
  });

export const usePermissions = () =>
  useQuery({ queryKey: ["admin", "permissions"], queryFn: fetchPermissions });

export const useCreateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
};

export const useUpdateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateRole>[1] }) =>
      updateRole(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
};

export const useDeleteRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
};
