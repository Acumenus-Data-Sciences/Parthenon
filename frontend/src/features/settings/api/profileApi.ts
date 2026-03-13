import apiClient from "@/lib/api-client";
import type { User } from "@/types/models";

export interface UpdateProfilePayload {
  name: string;
  phone_number: string | null;
  job_title: string | null;
  department: string | null;
  organization: string | null;
  bio: string | null;
}

interface ProfileResponse {
  message: string;
  user: User;
}

interface AvatarResponse {
  message: string;
  avatar: string;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<ProfileResponse> {
  const { data } = await apiClient.put<ProfileResponse>("/user/profile", payload);
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

export async function deleteAvatar(): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>("/user/avatar");
  return data;
}
