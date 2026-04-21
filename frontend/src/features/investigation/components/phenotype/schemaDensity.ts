export interface DomainCount {
  name: string;
  count: number;
  color: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  Condition: "var(--primary)",
  Drug: "var(--success)",
  Measurement: "var(--accent)",
  Procedure: "var(--domain-procedure)",
  Observation: "var(--domain-observation)",
  Device: "var(--domain-device)",
};

export function buildDomainCounts(
  entries: Array<{ concept: { domain_id: string } }>,
): DomainCount[] {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const d = entry.concept.domain_id || "Unknown";
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      color: DOMAIN_COLORS[name] ?? "var(--text-muted)",
    }))
    .sort((a, b) => b.count - a.count);
}
