import { useMutation } from "@tanstack/react-query";
import {
  deleteAvatar,
  updateLocale,
  updateProfile,
  uploadAvatar,
} from "../api/profileApi";
import type { UpdateLocalePayload, UpdateProfilePayload } from "../api/profileApi";
import { useAuthStore } from "@/stores/authStore";
import { normalizeLocale } from "@/i18n/locales";
import { setActiveLocale } from "@/i18n/i18n";

export function useUpdateProfile() {
  const updateUser = useAuthStore((s) => s.updateUser);

  return useMutation({
    mutationFn: (data: UpdateProfilePayload) => updateProfile(data),
    onSuccess: (response) => {
      updateUser(response.user);
    },
  });
}

export function useUpdateLocale() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  return useMutation({
    mutationFn: (data: UpdateLocalePayload) => updateLocale(data),
    onMutate: async (payload) => {
      const previousUser = useAuthStore.getState().user;
      const locale = normalizeLocale(payload.locale);

      if (previousUser) {
        updateUser({ ...previousUser, locale });
      }
      void setActiveLocale(locale);

      return { previousUser };
    },
    onSuccess: (response) => {
      const latestUser = useAuthStore.getState().user ?? user;
      const locale = normalizeLocale(response.locale);

      if (latestUser) {
        updateUser({ ...latestUser, locale });
      }
      void setActiveLocale(locale);
    },
    onError: (_error, _payload, context) => {
      if (context?.previousUser) {
        updateUser(context.previousUser);
        void setActiveLocale(context.previousUser.locale);
      }
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
