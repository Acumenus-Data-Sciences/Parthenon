import apiClient from "@/lib/api-client";

export interface JupyterMount {
  label: string;
  path: string;
  description: string;
}

export interface JupyterStarterNotebook {
  name: string;
  filename: string;
  description: string;
  url: string;
}

export interface JupyterWorkspace {
  available: boolean;
  status: "healthy" | "unavailable";
  label: string;
  summary: string;
  embed_url: string;
  lab_url: string;
  tree_url: string;
  starter_notebook_url: string;
  base_url: string;
  workspace_path: string;
  repository_path: string;
  mounts: JupyterMount[];
  starter_notebooks: JupyterStarterNotebook[];
  health: Record<string, unknown> | null;
  hints: string[];
}

export interface JupyterHealth {
  available: boolean;
  status: "healthy" | "unavailable";
  details?: Record<string, unknown>;
}

export async function fetchJupyterWorkspace(): Promise<JupyterWorkspace> {
  const { data } = await apiClient.get("/jupyter/workspace");
  return data.data;
}

export async function fetchJupyterHealth(): Promise<JupyterHealth> {
  const { data } = await apiClient.get("/jupyter/health");
  return data.data;
}
