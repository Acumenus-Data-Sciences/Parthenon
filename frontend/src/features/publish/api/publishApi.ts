// ---------------------------------------------------------------------------
// Publish & Export API (v2 — Pre-Publication Document Generator)
// ---------------------------------------------------------------------------

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { NarrativeResponse, ExportFormat } from "../types/publish";
import type { Study } from "@/features/studies/types/study";

// ── Legacy hooks (kept for backward compat) ─────────────────────────────────

export function useStudiesForPublish() {
  return useQuery<Study[]>({
    queryKey: ["publish", "studies"],
    queryFn: async () => {
      const { data } = await apiClient.get("/studies", {
        params: { per_page: 100, include: "analyses" },
      });
      return (data.data ?? data) as Study[];
    },
  });
}

export function useStudyWithAnalyses(studyId: number | null) {
  return useQuery<Study>({
    queryKey: ["publish", "study", studyId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/studies/${studyId}`);
      return (data.data ?? data) as Study;
    },
    enabled: studyId !== null,
  });
}

// ── Narrative generation ────────────────────────────────────────────────────

export interface NarrativeRequest {
  section_type: "methods" | "results" | "discussion" | "caption";
  analysis_id?: number;
  execution_id?: number;
  context: Record<string, unknown>;
}

export const generateNarrative = async (req: NarrativeRequest): Promise<NarrativeResponse> => {
  const { data } = await apiClient.post<{ data: NarrativeResponse }>("/publish/narrative", req);
  return data.data ?? data;
};

// ── Document export ─────────────────────────────────────────────────────────

export interface ExportRequest {
  template: string;
  format: ExportFormat;
  title: string;
  authors: string[];
  sections: Array<{
    type: string;
    title?: string;
    content?: string;
    included: boolean;
    svg?: string;
    caption?: string;
    diagram_type?: string;
    table_data?: {
      caption: string;
      headers: string[];
      rows: Array<Record<string, string | number>>;
      footnotes?: string[];
    };
  }>;
}

export const exportDocument = async (req: ExportRequest): Promise<Blob> => {
  const { data } = await apiClient.post("/publish/export", req, {
    responseType: "blob",
  });
  return data;
};

// ── Analysis picker queries ─────────────────────────────────────────────────

export interface AnalysisPickerItem {
  id: number;
  name: string;
  type: string;
  description: string | null;
  design_json: Record<string, unknown>;
  latest_execution: {
    id: number;
    status: string;
    result_json: Record<string, unknown> | null;
    completed_at: string | null;
  } | null;
}

export const fetchAllAnalyses = async (): Promise<AnalysisPickerItem[]> => {
  const types = [
    "characterizations",
    "estimations",
    "predictions",
    "incidence-rates",
    "sccs",
    "evidence-synthesis",
    "pathways",
  ];

  const results = await Promise.all(
    types.map(async (type) => {
      try {
        const { data } = await apiClient.get(`/${type}`, { params: { per_page: 100 } });
        const items = data.data ?? data;
        const list = Array.isArray(items) ? items : items.data ?? [];
        return list.map((item: Record<string, unknown>) => ({
          ...item,
          type: type.replace(/-/g, "_"),
        }));
      } catch {
        return [];
      }
    })
  );

  return results.flat() as AnalysisPickerItem[];
};

// ── Client-side export helpers ──────────────────────────────────────────────

export function exportAsPdf(containerId: string): void {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.classList.add("publish-print-active");
  window.print();
  setTimeout(() => el.classList.remove("publish-print-active"), 500);
}

export function exportAsImageBundle(containerId: string, format: "png" | "svg"): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const svgs = container.querySelectorAll("svg");
  if (svgs.length === 0) {
    alert("No charts found to export.");
    return;
  }

  const serializer = new XMLSerializer();

  svgs.forEach((svg, i) => {
    const svgString = serializer.serializeToString(svg);
    if (format === "svg") {
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chart-${i + 1}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        canvas.width = img.width || 800;
        canvas.height = img.height || 600;
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `chart-${i + 1}.png`;
        a.click();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  });
}
