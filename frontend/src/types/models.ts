export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
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
