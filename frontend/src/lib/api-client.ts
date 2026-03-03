import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

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
