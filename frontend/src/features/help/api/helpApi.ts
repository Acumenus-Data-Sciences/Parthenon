import apiClient from "@/lib/api-client";

export interface HelpContent {
  key: string;
  title: string;
  description: string;
  docs_url: string | null;
  video_url: string | null;
  tips: string[];
  locale?: string;
  requested_locale?: string;
  fallback_used?: boolean;
}

export interface ChangelogSection {
  [section: string]: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  sections: ChangelogSection;
}

export async function getHelp(key: string): Promise<HelpContent> {
  const { data } = await apiClient.get<HelpContent>(`/help/${key}`);
  return data;
}

export async function getChangelog(): Promise<ChangelogEntry[]> {
  const { data } = await apiClient.get<{ entries: ChangelogEntry[] }>(
    "/changelog",
  );
  return data.entries;
}
