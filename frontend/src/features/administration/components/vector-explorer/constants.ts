/** Design tokens and configuration for Vector Explorer. */

// ── Color Palette ───────────────────────────────────────────────────────────

/** Categorical palette for clusters (up to 20 colors). */
export const CLUSTER_PALETTE = [
  "#2DD4BF", "#C9A227", "#9B1B30", "#60a5fa", "#a78bfa",
  "#f472b6", "#fb923c", "#4ade80", "#e879f9", "#38bdf8",
  "#fbbf24", "#34d399", "#f87171", "#818cf8", "#22d3ee",
  "#a3e635", "#e2e8f0", "#fda4af", "#93c5fd", "#d8b4fe",
] as const;

export interface CollectionTheme {
  accent: string;
  bg: string;
  border: string;
  text: string;
  palette: readonly string[];
}

export interface SampleStep {
  label: string;
  value: number;
  effectiveValue: number;
}

function buildPalette(primary: string, secondary: string[]): readonly string[] {
  const filtered = secondary.filter((color) => color !== primary);
  return [primary, ...filtered] as const;
}

export const COLLECTION_THEMES: Record<string, CollectionTheme> = {
  docs: {
    accent: "#2DD4BF",
    bg: "rgba(45, 212, 191, 0.10)",
    border: "rgba(45, 212, 191, 0.25)",
    text: "#2DD4BF",
    palette: buildPalette("#2DD4BF", [...CLUSTER_PALETTE]),
  },
  ohdsi_papers: {
    accent: "#C9A227",
    bg: "rgba(201, 162, 39, 0.12)",
    border: "rgba(201, 162, 39, 0.28)",
    text: "#C9A227",
    palette: buildPalette("#C9A227", [...CLUSTER_PALETTE]),
  },
  medical_textbooks: {
    accent: "#60A5FA",
    bg: "rgba(96, 165, 250, 0.12)",
    border: "rgba(96, 165, 250, 0.28)",
    text: "#60A5FA",
    palette: buildPalette("#60A5FA", [...CLUSTER_PALETTE]),
  },
  clinical_reference: {
    accent: "#9B1B30",
    bg: "rgba(155, 27, 48, 0.12)",
    border: "rgba(155, 27, 48, 0.28)",
    text: "#E85A6B",
    palette: buildPalette("#9B1B30", [...CLUSTER_PALETTE]),
  },
  faq_shared: {
    accent: "#A78BFA",
    bg: "rgba(167, 139, 250, 0.12)",
    border: "rgba(167, 139, 250, 0.28)",
    text: "#A78BFA",
    palette: buildPalette("#A78BFA", [...CLUSTER_PALETTE]),
  },
  conversation_memory: {
    accent: "#FB923C",
    bg: "rgba(251, 146, 60, 0.12)",
    border: "rgba(251, 146, 60, 0.28)",
    text: "#FB923C",
    palette: buildPalette("#FB923C", [...CLUSTER_PALETTE]),
  },
};

export function getCollectionTheme(collectionName: string | null | undefined): CollectionTheme {
  if (collectionName && COLLECTION_THEMES[collectionName]) {
    return COLLECTION_THEMES[collectionName];
  }
  return {
    accent: "#2DD4BF",
    bg: "rgba(45, 212, 191, 0.10)",
    border: "rgba(45, 212, 191, 0.25)",
    text: "#2DD4BF",
    palette: CLUSTER_PALETTE,
  };
}

/** Quality mode colors. */
export const QUALITY_COLORS = {
  normal: "#4ade80",
  outlier: "#E85A6B",
  duplicate: "#F59E0B",
  orphan: "#5A5650",
} as const;

/** Similarity gradient stops (teal → gold → crimson). */
export const SIMILARITY_GRADIENT = {
  high: "#2DD4BF",
  mid: "#C9A227",
  low: "#9B1B30",
} as const;

// ── Scene ───────────────────────────────────────────────────────────────────

export const SCENE_BG = "#0A0A0F";
export const POINT_RADIUS = 0.02;
export const POINT_SEGMENTS = 8;
export const HOVER_SCALE = 1.3;
export const CAMERA_LERP_DURATION = 300;

// ── Sample Sizes ────────────────────────────────────────────────────────────

const FALLBACK_SAMPLE_STEPS = [
  { label: "1K", value: 1000 },
  { label: "5K", value: 5000 },
  { label: "15K", value: 15000 },
  { label: "All", value: 0 },
] as const;

export const DEFAULT_SAMPLE_SIZE = 5000;
export const DEBOUNCE_MS = 500;
export const LARGE_COLLECTION_ALL_THRESHOLD = 20000;

function formatSampleLabel(value: number): string {
  if (value >= 1000 && value % 1000 === 0) {
    return `${value / 1000}K`;
  }
  return value.toLocaleString();
}

export function getAdaptiveSampleSteps(totalCount: number): SampleStep[] {
  if (totalCount <= 0) {
    return FALLBACK_SAMPLE_STEPS.map((step) => ({
      ...step,
      effectiveValue: step.value === 0 ? DEFAULT_SAMPLE_SIZE : step.value,
    }));
  }

  const candidates =
    totalCount <= 2000
      ? [500, 1000, 2000]
      : totalCount <= 10000
        ? [500, 1000, 2000, 5000, 10000]
        : totalCount <= 50000
          ? [1000, 5000, 10000, 15000, 25000, 50000]
          : [1000, 5000, 10000, 25000, 50000];

  const steps = candidates
    .filter((value) => value >= 500 && value < totalCount)
    .map((value) => ({
      label: formatSampleLabel(value),
      value,
      effectiveValue: value,
    }));

  return [
    ...steps,
    {
      label: "All",
      value: 0,
      effectiveValue: totalCount,
    },
  ];
}

export function getRecommendedSampleSize(totalCount: number): number {
  if (totalCount <= 0) {
    return DEFAULT_SAMPLE_SIZE;
  }

  const target = Math.min(totalCount, DEFAULT_SAMPLE_SIZE);
  const steps = getAdaptiveSampleSteps(totalCount);

  let bestStep = steps[steps.length - 1]?.value ?? 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const step of steps) {
    const diff = Math.abs(step.effectiveValue - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestStep = step.value;
    }
  }

  return bestStep;
}

// ── Modes ───────────────────────────────────────────────────────────────────

export type ExplorerMode = "clusters" | "query" | "qa";

export const MODE_LABELS: Record<ExplorerMode, string> = {
  clusters: "Clusters",
  query: "Query",
  qa: "QA",
};

// ── Query Projection ────────────────────────────────────────────────────────

export const KNN_NEIGHBORS = 5;
export const KNN_MIN_SIMILARITY = 0.3;
