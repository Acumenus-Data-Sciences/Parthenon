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
}

export interface JupyterWorkspace {
  available: boolean;
  status: "healthy" | "unavailable";
  server_status: "running" | "spawning" | "stopped";
  label: string;
  summary: string;
  workspace_path: string;
  shared_path: string;
  repository_path: string;
  mounts: JupyterMount[];
  starter_notebooks: JupyterStarterNotebook[];
  hints: string[];
}

export interface JupyterSession {
  token: string;
  login_url: string;
  expires_in: number;
}

export interface JupyterHealth {
  available: boolean;
  status: "healthy" | "unavailable";
}

export async function fetchJupyterWorkspace(): Promise<JupyterWorkspace> {
  const { data } = await apiClient.get("/jupyter/workspace");
  return data.data;
}

export async function fetchJupyterHealth(): Promise<JupyterHealth> {
  const { data } = await apiClient.get("/jupyter/health");
  return data.data;
}

export async function createJupyterSession(): Promise<JupyterSession> {
  const { data } = await apiClient.post("/jupyter/session");
  return data.data;
}

export async function destroyJupyterSession(): Promise<void> {
  await apiClient.delete("/jupyter/session");
}
