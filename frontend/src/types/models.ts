export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  phone_number: string | null;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  roles?: string[];
  permissions?: string[];
}

export interface Role {
  id: number;
  name: string;
  guard_name: string;
  users_count?: number;
  permissions?: Permission[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  name: string;
  guard_name: string;
}

export type AuthProviderType = "ldap" | "oauth2" | "saml2" | "oidc";

export interface AuthProviderSetting {
  id: number;
  provider_type: AuthProviderType;
  display_name: string;
  is_enabled: boolean;
  priority: number;
  settings: LdapSettings | OAuth2Settings | Saml2Settings | OidcSettings;
  updated_by: number | null;
  updated_at: string;
}

export interface LdapSettings {
  host: string;
  port: number;
  base_dn: string;
  bind_dn: string;
  bind_password: string;
  user_search_base: string;
  user_filter: string;
  username_field: string;
  email_field: string;
  name_field: string;
  group_sync: boolean;
  group_search_base: string;
  group_filter: string;
  use_ssl: boolean;
  use_tls: boolean;
  timeout: number;
}

export interface OAuth2Settings {
  driver: "github" | "google" | "microsoft" | "custom";
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string[];
  auth_url: string;
  token_url: string;
  userinfo_url: string;
}

export interface Saml2Settings {
  idp_entity_id: string;
  idp_sso_url: string;
  idp_slo_url: string;
  idp_certificate: string;
  sp_entity_id: string;
  sp_acs_url: string;
  sp_slo_url: string;
  name_id_format: string;
  sign_assertions: boolean;
  attribute_mapping: { email: string; name: string };
}

export interface OidcSettings {
  client_id: string;
  client_secret: string;
  discovery_url: string;
  redirect_uri: string;
  scopes: string[];
  pkce_enabled: boolean;
}

export type AiProviderType = "ollama" | "anthropic" | "openai" | "gemini" | "deepseek" | "qwen" | "moonshot" | "mistral";

export interface AiProviderSetting {
  id: number;
  provider_type: AiProviderType;
  display_name: string;
  is_enabled: boolean;
  is_active: boolean;
  model: string;
  settings: Record<string, string | number | boolean>;
  updated_by: number | null;
  updated_at: string;
}

export interface SystemHealthService {
  name: string;
  key: string;
  status: "healthy" | "degraded" | "down";
  message: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  services: SystemHealthService[];
  checked_at: string;
}

export interface Source {
  id: number;
  source_name: string;
  source_key: string;
  source_dialect: string;
  source_connection: string;
  is_cache_enabled: boolean;
  daimons: SourceDaimon[];
  created_at: string;
  updated_at: string;
}

export interface SourceDaimon {
  id: number;
  source_id: number;
  daimon_type: "cdm" | "vocabulary" | "results" | "temp";
  table_qualifier: string;
  priority: number;
}
