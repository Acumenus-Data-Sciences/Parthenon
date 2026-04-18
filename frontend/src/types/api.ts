import type { User } from "./models";

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiMessageMeta {
  requested_locale: string;
  message_locale: string | null;
  fallback_locale: string;
  fallback_used: boolean;
  translation_missing: boolean;
}

export interface ApiMessageEnvelope {
  message: string;
  message_key?: string;
  message_params?: Record<string, string | number>;
  message_meta?: ApiMessageMeta;
}

export interface ApiError extends ApiMessageEnvelope {
  errors?: Record<string, string[]>;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  services: {
    database: string;
    redis: string;
    ai: string;
    darkstar: string;
  };
}
