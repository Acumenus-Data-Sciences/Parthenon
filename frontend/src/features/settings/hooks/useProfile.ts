import { useMutation } from "@tanstack/react-query";
import { updateProfile, uploadAvatar, deleteAvatar } from "../api/profileApi";
import type { UpdateProfilePayload } from "../api/profileApi";
import { useAuthStore } from "@/stores/authStore";

export function useUpdateProfile() {
  const updateUser = useAuthStore((s) => s.updateUser);

  return useMutation({
    mutationFn: (data: UpdateProfilePayload) => updateProfile(data),
    onSuccess: (response) => {
      updateUser(response.user);
    },
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
  });
}

export function useDeleteAvatar() {
  return useMutation({
    mutationFn: () => deleteAvatar(),
  });
}
