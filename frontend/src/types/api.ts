import type { User } from "./models";

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  message: string;
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
    r_runtime: string;
  };
}
