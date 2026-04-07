import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  WikiActivityItem,
  WikiIngestResponse,
  WikiLintResponse,
  WikiPageDetail,
  WikiPageListResponse,
  WikiPageSummary,
  WikiQueryResponse,
  WikiWorkspace,
} from "../types/wiki";

const WIKI_WORKSPACES_KEY = "wiki-workspaces";
const WIKI_PAGES_KEY = "wiki-pages";
const WIKI_PAGE_KEY = "wiki-page";
const WIKI_ACTIVITY_KEY = "wiki-activity";

async function fetchWorkspaces(): Promise<WikiWorkspace[]> {
  const { data } = await apiClient.get<{ workspaces: WikiWorkspace[] }>("/wiki/workspaces");
  return data.workspaces;
}

async function initWorkspace(name: string): Promise<WikiWorkspace> {
  const { data } = await apiClient.post<{ workspace: WikiWorkspace }>(
    `/wiki/workspaces/${encodeURIComponent(name)}/init`,
  );
  return data.workspace;
}

async function fetchPages(
  workspace: string,
  query?: string,
  limit?: number,
  offset?: number,
): Promise<WikiPageListResponse> {
  const { data } = await apiClient.get<WikiPageListResponse>("/wiki/pages", {
    params: { workspace, q: query || undefined, limit, offset },
  });
  return data;
}

async function fetchPage(workspace: string, slug: string): Promise<WikiPageDetail> {
  const { data } = await apiClient.get<WikiPageDetail>(`/wiki/pages/${encodeURIComponent(slug)}`, {
    params: { workspace },
  });
  return data;
}

async function fetchActivity(workspace: string): Promise<WikiActivityItem[]> {
  const { data } = await apiClient.get<{ activity: WikiActivityItem[] }>("/wiki/activity", {
    params: { workspace },
  });
  return data.activity;
}

async function ingestWikiSource(payload: {
  workspace: string;
  title?: string;
  rawContent?: string;
  file?: File | null;
}): Promise<WikiIngestResponse> {
  const formData = new FormData();
  formData.append("workspace", payload.workspace);
  if (payload.title) formData.append("title", payload.title);
  if (payload.rawContent) formData.append("raw_content", payload.rawContent);
  if (payload.file) formData.append("file", payload.file);
  const { data } = await apiClient.post<WikiIngestResponse>("/wiki/ingest", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

async function queryWiki(payload: {
  workspace: string;
  question: string;
}): Promise<WikiQueryResponse> {
  const { data } = await apiClient.post<WikiQueryResponse>("/wiki/query", payload);
  return data;
}

async function lintWiki(payload: { workspace: string }): Promise<WikiLintResponse> {
  const { data } = await apiClient.post<WikiLintResponse>("/wiki/lint", payload);
  return data;
}

export function sourceDownloadUrl(workspace: string, filename: string): string {
  return `/wiki/sources/${encodeURIComponent(workspace)}/${encodeURIComponent(filename)}`;
}

export function useWikiWorkspaces() {
  return useQuery({
    queryKey: [WIKI_WORKSPACES_KEY],
    queryFn: fetchWorkspaces,
  });
}

export function useInitWikiWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: initWorkspace,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [WIKI_WORKSPACES_KEY] });
    },
  });
}

export function useWikiPages(workspace: string, query?: string, limit?: number, offset?: number) {
  return useQuery({
    queryKey: [WIKI_PAGES_KEY, workspace, query ?? "", limit ?? "all", offset ?? 0],
    queryFn: () => fetchPages(workspace, query, limit, offset),
    enabled: !!workspace,
  });
}

export function useWikiPage(workspace: string, slug: string | null) {
  return useQuery({
    queryKey: [WIKI_PAGE_KEY, workspace, slug],
    queryFn: () => fetchPage(workspace, slug!),
    enabled: !!workspace && !!slug,
  });
}

export function useWikiActivity(workspace: string) {
  return useQuery({
    queryKey: [WIKI_ACTIVITY_KEY, workspace],
    queryFn: () => fetchActivity(workspace),
    enabled: !!workspace,
    refetchInterval: 20_000,
  });
}

export function useIngestWikiSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ingestWikiSource,
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [WIKI_PAGES_KEY, variables.workspace] });
      void qc.invalidateQueries({ queryKey: [WIKI_ACTIVITY_KEY, variables.workspace] });
      void qc.invalidateQueries({ queryKey: [WIKI_WORKSPACES_KEY] });
    },
  });
}

export function useWikiQuery() {
  return useMutation({
    mutationFn: queryWiki,
  });
}

export function useWikiLint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: lintWiki,
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [WIKI_ACTIVITY_KEY, variables.workspace] });
    },
  });
}
