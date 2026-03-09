// ---------------------------------------------------------------------------
// Publish & Export API Hooks
// ---------------------------------------------------------------------------

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { Study } from "@/features/studies/types/study";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useStudiesForPublish() {
  return useQuery<Study[]>({
    queryKey: ["publish", "studies"],
    queryFn: async () => {
      const { data } = await apiClient.get("/studies", {
        params: { per_page: 100 },
      });
      // Laravel paginated response: { data: T[], ... }
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

// ---------------------------------------------------------------------------
// Export Helpers (client-side)
// ---------------------------------------------------------------------------

export function exportAsPdf(containerId: string): void {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Add print class, trigger print, remove class
  el.classList.add("publish-print-active");
  window.print();
  // Class removal happens after print dialog closes
  setTimeout(() => el.classList.remove("publish-print-active"), 500);
}

export function exportAsImageBundle(
  _containerId: string,
  format: "png" | "svg",
): void {
  // Collect all SVG elements from the preview container
  const container = document.getElementById(_containerId);
  if (!container) return;

  const svgs = container.querySelectorAll("svg");
  if (svgs.length === 0) {
    alert("No charts found to export.");
    return;
  }

  if (format === "svg") {
    // Single SVG download for simplicity (no JSZip dependency)
    svgs.forEach((svg, i) => {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chart-${i + 1}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    });
  } else {
    // PNG: render SVG to canvas, then download
    svgs.forEach((svg, i) => {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
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
    });
  }
}

export function exportPlaceholder(format: "docx" | "xlsx"): void {
  alert(
    `Coming soon — ${format.toUpperCase()} export requires server-side generation.`,
  );
}
