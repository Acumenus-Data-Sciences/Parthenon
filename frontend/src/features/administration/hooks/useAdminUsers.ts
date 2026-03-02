import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchUsers,
  fetchUser,
  createUser,
  updateUser,
  deleteUser,
  syncUserRoles,
  fetchAvailableRoles,
  type UserFilters,
} from "../api/adminApi";

export const useUsers = (filters: UserFilters = {}) =>
  useQuery({
    queryKey: ["admin", "users", filters],
    queryFn: () => fetchUsers(filters),
  });

export const useUser = (id: number) =>
  useQuery({
    queryKey: ["admin", "users", id],
    queryFn: () => fetchUser(id),
    enabled: id > 0,
  });

export const useAvailableRoles = () =>
  useQuery({
    queryKey: ["admin", "available-roles"],
    queryFn: fetchAvailableRoles,
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
};

export const useSyncUserRoles = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }: { id: number; roles: string[] }) =>
      syncUserRoles(id, roles),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
};
