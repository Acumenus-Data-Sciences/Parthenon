import axios from "axios";
import { getStoredLocalePreference, normalizeLocale } from "@/i18n/locales";
import { useAuthStore } from "@/stores/authStore";
import { useSourceStore } from "@/stores/sourceStore";

const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const sourceId = useSourceStore.getState().activeSourceId;
  if (sourceId) {
    config.headers["X-Source-Id"] = String(sourceId);
  }

  const locale =
    useAuthStore.getState().user?.locale ??
    getStoredLocalePreference() ??
    (typeof document !== "undefined" ? document.documentElement.lang : null);
  if (locale) {
    const normalizedLocale = normalizeLocale(locale);
    config.headers["Accept-Language"] = normalizedLocale;
    config.headers["X-Parthenon-Locale"] = normalizedLocale;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error as Error);
  },
);

/**
 * Transform Laravel's paginator response to the frontend's PaginatedResponse format.
 * Laravel: { data: T[], total, current_page, per_page, ... }
 * Frontend: { items: T[], total, page, limit }
 */
export function toLaravelPaginated<T>(response: {
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
}): { items: T[]; total: number; page: number; limit: number } {
  return {
    items: response.data ?? [],
    total: response.total ?? 0,
    page: response.current_page ?? 1,
    limit: response.per_page ?? 20,
  };
}

export default apiClient;
