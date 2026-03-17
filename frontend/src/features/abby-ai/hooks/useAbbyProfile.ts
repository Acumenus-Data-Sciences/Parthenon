import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAbbyProfile,
  updateAbbyProfile,
  resetAbbyProfile,
} from '../../commons/services/abbyService';
import type { AbbyProfileUpdateRequest } from '../types/memory';

export function useAbbyProfile() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['abby-profile'],
    queryFn: fetchAbbyProfile,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: AbbyProfileUpdateRequest) => updateAbbyProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abby-profile'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetAbbyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abby-profile'] });
    },
  });

  return {
    profile: profileQuery.data?.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateMutation.mutate,
    resetProfile: resetMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
