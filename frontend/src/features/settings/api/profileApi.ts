import apiClient from "@/lib/api-client";
import type { ApiMessageEnvelope } from "@/types/api";
import type { User } from "@/types/models";

export interface UpdateProfilePayload {
  name: string;
  phone_number: string | null;
  job_title: string | null;
  department: string | null;
  organization: string | null;
  bio: string | null;
}

interface ProfileResponse extends ApiMessageEnvelope {
  user: User;
}

interface AvatarResponse extends ApiMessageEnvelope {
  avatar: string;
}

export interface UpdateLocalePayload {
  locale: string;
}

export interface LocaleResponse extends ApiMessageEnvelope {
  locale: string;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<ProfileResponse> {
  const { data } = await apiClient.put<ProfileResponse>("/user/profile", payload);
  return data;
}

export async function updateLocale(payload: UpdateLocalePayload): Promise<LocaleResponse> {
  const { data } = await apiClient.put<LocaleResponse>("/user/locale", payload);
  return data;
}

export async function uploadAvatar(file: File): Promise<AvatarResponse> {
  const formData = new FormData();
  formData.append("avatar", file);
  const { data } = await apiClient.post<AvatarResponse>("/user/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteAvatar(): Promise<ApiMessageEnvelope> {
  const { data } = await apiClient.delete<ApiMessageEnvelope>("/user/avatar");
  return data;
}
