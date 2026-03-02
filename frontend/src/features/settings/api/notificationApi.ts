import apiClient from "@/lib/api-client";
import type { NotificationPreferences } from "../types/notifications";

const BASE = "/user/notification-preferences";

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await apiClient.get<NotificationPreferences>(BASE);
  return data;
}

export async function updateNotificationPreferences(
  payload: NotificationPreferences,
): Promise<NotificationPreferences> {
  const { data } = await apiClient.put<NotificationPreferences>(BASE, payload);
  return data;
}
