# Analysis Visualization Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add verdict dashboards with clinical decision metrics (NNT/NNH, calibrated p-values, heterogeneity maps) and enhance existing charts with interactive overlays across all 6 analysis types.

**Architecture:** Each analysis type gets a new `<XxxVerdictDashboard>` component inserted above the existing charts in its `XxxResults.tsx`. Shared primitives (SignificanceVerdictBadge, TrafficLightBadge, MetricCard, CIBar) live in a new `frontend/src/components/charts/` directory. Existing SVG charts get enhancements in-place. Cross-cutting features (export, comparison, print mode) are added last.

**Tech Stack:** React 19, TypeScript strict, custom SVG, framer-motion (animations), D3 (scale computations), Tailwind 4. No new dependencies for core work; html2canvas + jspdf added only for PDF export in the final phase.

---

## Phase 1: Shared Primitives & Infrastructure

### Task 1.1: Shared Chart Primitive Components

**Files:**
- Create: `frontend/src/components/charts/SignificanceVerdictBadge.tsx`
- Create: `frontend/src/components/charts/TrafficLightBadge.tsx`
- Create: `frontend/src/components/charts/MetricCard.tsx`
- Create: `frontend/src/components/charts/CIBar.tsx`
- Create: `frontend/src/components/charts/index.ts`
- Test: `frontend/src/components/charts/__tests__/SignificanceVerdictBadge.test.tsx`
- Test: `frontend/src/components/charts/__tests__/TrafficLightBadge.test.tsx`
- Test: `frontend/src/components/charts/__tests__/MetricCard.test.tsx`
- Test: `frontend/src/components/charts/__tests__/CIBar.test.tsx`

**Step 1: Write failing tests for SignificanceVerdictBadge**

```typescript
// frontend/src/components/charts/__tests__/SignificanceVerdictBadge.test.tsx
import { render, screen } from "@testing-library/react";
import { SignificanceVerdictBadge } from "../SignificanceVerdictBadge";

describe("SignificanceVerdictBadge", () => {
  it("renders protective verdict when HR < 1 and p < 0.05", () => {
    render(<SignificanceVerdictBadge hr={0.72} pValue={0.003} />);
    expect(screen.getByText(/significant protective effect/i)).toBeInTheDocument();
  });

  it("renders harmful verdict when HR > 1 and p < 0.05", () => {
    render(<SignificanceVerdictBadge hr={1.45} pValue={0.01} />);
    expect(screen.getByText(/significant harmful effect/i)).toBeInTheDocument();
  });

  it("renders not significant when p >= 0.05", () => {
    render(<SignificanceVerdictBadge hr={0.95} pValue={0.42} />);
    expect(screen.getByText(/not statistically significant/i)).toBeInTheDocument();
  });

  it("renders not significant when CI spans null", () => {
    render(<SignificanceVerdictBadge hr={0.85} pValue={0.08} ciLower={0.7} ciUpper={1.1} />);
    expect(screen.getByText(/not statistically significant/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/charts/__tests__/SignificanceVerdictBadge.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement SignificanceVerdictBadge**

```typescript
// frontend/src/components/charts/SignificanceVerdictBadge.tsx
import { cn } from "@/lib/utils";

interface SignificanceVerdictBadgeProps {
  hr: number;
  pValue: number;
  ciLower?: number;
  ciUpper?: number;
  className?: string;
}

type Verdict = "protective" | "harmful" | "not_significant";

function getVerdict(hr: number, pValue: number, ciLower?: number, ciUpper?: number): Verdict {
  // CI spanning null always means not significant
  if (ciLower !== undefined && ciUpper !== undefined && ciLower < 1 && ciUpper > 1) {
    return "not_significant";
  }
  if (pValue >= 0.05) return "not_significant";
  return hr < 1 ? "protective" : "harmful";
}

const VERDICT_CONFIG: Record<Verdict, { label: string; bg: string; text: string; border: string }> = {
  protective: {
    label: "Significant protective effect",
    bg: "bg-teal-500/10",
    text: "text-[#2DD4BF]",
    border: "border-[#2DD4BF]/30",
  },
  harmful: {
    label: "Significant harmful effect",
    bg: "bg-red-500/10",
    text: "text-[#E85A6B]",
    border: "border-[#E85A6B]/30",
  },
  not_significant: {
    label: "Not statistically significant",
    bg: "bg-gray-500/10",
    text: "text-[#8A857D]",
    border: "border-[#8A857D]/30",
  },
};

export function SignificanceVerdictBadge({ hr, pValue, ciLower, ciUpper, className }: SignificanceVerdictBadgeProps) {
  const verdict = getVerdict(hr, pValue, ciLower, ciUpper);
  const config = VERDICT_CONFIG[verdict];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
        config.bg, config.text, config.border,
        className
      )}
    >
      {verdict === "protective" && <span>↓</span>}
      {verdict === "harmful" && <span>↑</span>}
      {config.label}
    </span>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/charts/__tests__/SignificanceVerdictBadge.test.tsx`
Expected: PASS

**Step 5: Write failing tests for TrafficLightBadge**

```typescript
// frontend/src/components/charts/__tests__/TrafficLightBadge.test.tsx
import { render, screen } from "@testing-library/react";
import { TrafficLightBadge } from "../TrafficLightBadge";

describe("TrafficLightBadge", () => {
  it("renders green for good AUC", () => {
    render(<TrafficLightBadge value={0.85} thresholds={{ green: 0.8, amber: 0.7 }} label="AUC" />);
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("0.850")).toBeInTheDocument();
  });

  it("renders amber for acceptable AUC", () => {
    render(<TrafficLightBadge value={0.75} thresholds={{ green: 0.8, amber: 0.7 }} label="AUC" />);
    expect(screen.getByText("Acceptable")).toBeInTheDocument();
  });

  it("renders red for poor AUC", () => {
    render(<TrafficLightBadge value={0.6} thresholds={{ green: 0.8, amber: 0.7 }} label="AUC" />);
    expect(screen.getByText("Poor")).toBeInTheDocument();
  });
});
```

**Step 6: Implement TrafficLightBadge**

```typescript
// frontend/src/components/charts/TrafficLightBadge.tsx
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/formatters";

interface TrafficLightBadgeProps {
  value: number;
  thresholds: { green: number; amber: number };
  label: string;
  higherIsBetter?: boolean; // default true
  className?: string;
}

type Level = "green" | "amber" | "red";

const LEVEL_CONFIG: Record<Level, { label: string; dot: string; text: string }> = {
  green: { label: "Good", dot: "bg-emerald-400", text: "text-emerald-400" },
  amber: { label: "Acceptable", dot: "bg-amber-400", text: "text-amber-400" },
  red: { label: "Poor", dot: "bg-red-400", text: "text-red-400" },
};

function getLevel(value: number, thresholds: { green: number; amber: number }, higherIsBetter: boolean): Level {
  if (higherIsBetter) {
    if (value >= thresholds.green) return "green";
    if (value >= thresholds.amber) return "amber";
    return "red";
  }
  if (value <= thresholds.green) return "green";
  if (value <= thresholds.amber) return "amber";
  return "red";
}

export function TrafficLightBadge({ value, thresholds, label, higherIsBetter = true, className }: TrafficLightBadgeProps) {
  const level = getLevel(value, thresholds, higherIsBetter);
  const config = LEVEL_CONFIG[level];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("h-2.5 w-2.5 rounded-full", config.dot)} />
      <span className="font-mono text-sm text-[#F0EDE8]">{fmt(value)}</span>
      <span className={cn("text-xs", config.text)}>{config.label}</span>
    </div>
  );
}
```

**Step 7: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/charts/__tests__/TrafficLightBadge.test.tsx`
Expected: PASS

**Step 8: Implement MetricCard and CIBar**

```typescript
// frontend/src/components/charts/MetricCard.tsx
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: "teal" | "gold" | "crimson" | "default";
  className?: string;
  children?: React.ReactNode;
}

const COLOR_MAP = {
  teal: "border-[#2DD4BF]/20",
  gold: "border-[#C9A227]/20",
  crimson: "border-[#E85A6B]/20",
  default: "border-[#232328]",
};

const VALUE_COLOR_MAP = {
  teal: "text-[#2DD4BF]",
  gold: "text-[#C9A227]",
  crimson: "text-[#E85A6B]",
  default: "text-[#F0EDE8]",
};

export function MetricCard({ label, value, subtitle, color = "default", className, children }: MetricCardProps) {
  return (
    <div className={cn("rounded-lg border bg-[#151518] p-4", COLOR_MAP[color], className)}>
      <p className="text-xs text-[#8A857D] uppercase tracking-wider">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-semibold", VALUE_COLOR_MAP[color])}>{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-[#5A5650]">{subtitle}</p>}
      {children}
    </div>
  );
}
```

```typescript
// frontend/src/components/charts/CIBar.tsx
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/formatters";

interface CIBarProps {
  estimate: number;
  ciLower: number;
  ciUpper: number;
  nullValue?: number; // default 1.0 for ratios, 0 for differences
  logScale?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function CIBar({
  estimate,
  ciLower,
  ciUpper,
  nullValue = 1,
  logScale = true,
  width = 300,
  height = 32,
  className,
}: CIBarProps) {
  const toScale = (v: number) => (logScale ? Math.log(v) : v);

  const minVal = toScale(Math.min(ciLower, nullValue) * 0.8);
  const maxVal = toScale(Math.max(ciUpper, nullValue) * 1.2);
  const range = maxVal - minVal;

  const toX = (v: number) => ((toScale(v) - minVal) / range) * width;

  const nullX = toX(nullValue);
  const estX = toX(estimate);
  const lowerX = toX(ciLower);
  const upperX = toX(ciUpper);
  const midY = height / 2;

  const spansNull = ciLower <= nullValue && ciUpper >= nullValue;
  const color = spansNull ? "#8A857D" : estimate < nullValue ? "#2DD4BF" : "#E85A6B";

  return (
    <svg width={width} height={height} className={className} role="img" aria-label={`CI: ${fmt(ciLower)} to ${fmt(ciUpper)}`}>
      {/* Null reference line */}
      <line x1={nullX} y1={4} x2={nullX} y2={height - 4} stroke="#C9A227" strokeWidth={1} strokeDasharray="3,3" />
      {/* CI line */}
      <line x1={lowerX} y1={midY} x2={upperX} y2={midY} stroke={color} strokeWidth={2} />
      {/* CI caps */}
      <line x1={lowerX} y1={midY - 4} x2={lowerX} y2={midY + 4} stroke={color} strokeWidth={2} />
      <line x1={upperX} y1={midY - 4} x2={upperX} y2={midY + 4} stroke={color} strokeWidth={2} />
      {/* Point estimate */}
      <circle cx={estX} cy={midY} r={4} fill={color} />
    </svg>
  );
}
```

```typescript
// frontend/src/components/charts/index.ts
export { SignificanceVerdictBadge } from "./SignificanceVerdictBadge";
export { TrafficLightBadge } from "./TrafficLightBadge";
export { MetricCard } from "./MetricCard";
export { CIBar } from "./CIBar";
```

**Step 9: Write and run tests for MetricCard and CIBar**

```typescript
// frontend/src/components/charts/__tests__/MetricCard.test.tsx
import { render, screen } from "@testing-library/react";
import { MetricCard } from "../MetricCard";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Hazard Ratio" value="0.72" />);
    expect(screen.getByText("Hazard Ratio")).toBeInTheDocument();
    expect(screen.getByText("0.72")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<MetricCard label="HR" value="0.72" subtitle="95% CI: 0.58-0.89" />);
    expect(screen.getByText("95% CI: 0.58-0.89")).toBeInTheDocument();
  });
});
```

```typescript
// frontend/src/components/charts/__tests__/CIBar.test.tsx
import { render } from "@testing-library/react";
import { CIBar } from "../CIBar";

describe("CIBar", () => {
  it("renders SVG with correct aria label", () => {
    const { container } = render(<CIBar estimate={0.72} ciLower={0.58} ciUpper={0.89} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("aria-label")).toContain("CI:");
  });

  it("renders null reference line", () => {
    const { container } = render(<CIBar estimate={0.72} ciLower={0.58} ciUpper={0.89} />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(3); // null line + CI line + 2 caps
  });
});
```

Run: `cd frontend && npx vitest run src/components/charts/__tests__/`
Expected: ALL PASS

**Step 10: Commit**

```bash
git add frontend/src/components/charts/
git commit -m "feat: add shared chart primitives — SignificanceVerdictBadge, TrafficLightBadge, MetricCard, CIBar"
```

---

### Task 1.2: Shared Interpretation Tooltip Component

**Files:**
- Create: `frontend/src/components/charts/InterpretationTooltip.tsx`
- Test: `frontend/src/components/charts/__tests__/InterpretationTooltip.test.tsx`
- Modify: `frontend/src/components/charts/index.ts`

**Step 1: Write failing test**

```typescript
// frontend/src/components/charts/__tests__/InterpretationTooltip.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { InterpretationTooltip } from "../InterpretationTooltip";

describe("InterpretationTooltip", () => {
  it("shows question mark icon", () => {
    render(
      <InterpretationTooltip
        metric="NNT"
        plain="Number of patients you need to treat to prevent one additional bad outcome."
        technical="NNT = 1 / Absolute Risk Reduction. Lower is better."
      />
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("expands on click to show plain and technical text", () => {
    render(
      <InterpretationTooltip
        metric="NNT"
        plain="Number of patients you need to treat to prevent one additional bad outcome."
        technical="NNT = 1 / Absolute Risk Reduction. Lower is better."
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/number of patients/i)).toBeInTheDocument();
    expect(screen.getByText(/absolute risk reduction/i)).toBeInTheDocument();
  });
});
```

**Step 2: Implement InterpretationTooltip**

```typescript
// frontend/src/components/charts/InterpretationTooltip.tsx
import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InterpretationTooltipProps {
  metric: string;
  plain: string;
  technical: string;
  className?: string;
}

export function InterpretationTooltip({ metric, plain, technical, className }: InterpretationTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("relative inline-block", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="text-[#5A5650] hover:text-[#8A857D] transition-colors"
        aria-label={`What does ${metric} mean?`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 shadow-lg z-50">
          <p className="text-xs font-medium text-[#F0EDE8] mb-1">{metric}</p>
          <p className="text-xs text-[#C5C0B8]">{plain}</p>
          <p className="text-xs text-[#5A5650] mt-1 italic">{technical}</p>
        </div>
      )}
    </span>
  );
}
```

**Step 3: Export from index, run tests, commit**

Add to `frontend/src/components/charts/index.ts`:
```typescript
export { InterpretationTooltip } from "./InterpretationTooltip";
```

Run: `cd frontend && npx vitest run src/components/charts/__tests__/`
Expected: ALL PASS

```bash
git add frontend/src/components/charts/
git commit -m "feat: add InterpretationTooltip for metric explainers"
```

---

### Task 1.3: Utility Functions for Clinical Metrics

**Files:**
- Modify: `frontend/src/lib/formatters.ts`
- Test: `frontend/src/lib/__tests__/formatters.test.ts` (create or extend)

**Step 1: Write failing tests for new utility functions**

```typescript
// frontend/src/lib/__tests__/formatters.test.ts (append or create)
import { computeNNT, computeRMST, computeRateDifference, heterogeneityLabel } from "../formatters";

describe("computeNNT", () => {
  it("returns NNT for absolute risk reduction > 0", () => {
    // Target survival 0.90, comparator survival 0.85 → ARR = 0.05 → NNT = 20
    expect(computeNNT(0.90, 0.85)).toBe(20);
  });

  it("returns NNH (negative) when treatment increases risk", () => {
    // Target survival 0.80, comparator survival 0.90 → ARR = -0.10 → NNH = -10
    expect(computeNNT(0.80, 0.90)).toBe(-10);
  });

  it("returns Infinity when no difference", () => {
    expect(computeNNT(0.85, 0.85)).toBe(Infinity);
  });
});

describe("computeRateDifference", () => {
  it("computes IRD with CI", () => {
    const result = computeRateDifference(15.2, 10.1, 1000);
    expect(result.ird).toBeCloseTo(5.1, 1);
    expect(result.ciLower).toBeLessThan(result.ird);
    expect(result.ciUpper).toBeGreaterThan(result.ird);
  });
});

describe("heterogeneityLabel", () => {
  it("returns Low for I² < 25", () => {
    expect(heterogeneityLabel(20)).toBe("Low");
  });
  it("returns Moderate for I² 25-75", () => {
    expect(heterogeneityLabel(50)).toBe("Moderate");
  });
  it("returns High for I² > 75", () => {
    expect(heterogeneityLabel(85)).toBe("High");
  });
});
```

**Step 2: Implement the functions**

Append to `frontend/src/lib/formatters.ts`:

```typescript
/** Compute NNT from survival probabilities. Positive = NNT (benefit), negative = NNH (harm). */
export function computeNNT(targetSurvival: number, comparatorSurvival: number): number {
  const arr = targetSurvival - comparatorSurvival;
  if (arr === 0) return Infinity;
  return Math.round(1 / arr);
}

/** Compute rate difference (IRD) per 1000 PY with approximate 95% CI. */
export function computeRateDifference(
  rate1: number,
  rate2: number,
  personYears: number
): { ird: number; ciLower: number; ciUpper: number } {
  const ird = rate1 - rate2;
  // Approximate SE for rate difference
  const se = Math.sqrt((rate1 + rate2) / personYears) * 1000;
  return {
    ird,
    ciLower: ird - 1.96 * se,
    ciUpper: ird + 1.96 * se,
  };
}

/** Label I² heterogeneity as Low / Moderate / High. */
export function heterogeneityLabel(iSquared: number): "Low" | "Moderate" | "High" {
  if (iSquared < 25) return "Low";
  if (iSquared <= 75) return "Moderate";
  return "High";
}

/** Format p-value for display. */
export function fmtP(p: number): string {
  if (p < 0.001) return "<0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}
```

**Step 3: Run tests, commit**

Run: `cd frontend && npx vitest run src/lib/__tests__/formatters.test.ts`
Expected: ALL PASS

```bash
git add frontend/src/lib/formatters.ts frontend/src/lib/__tests__/
git commit -m "feat: add clinical metric utilities — NNT, rate difference, heterogeneity labels"
```

---

## Phase 2: Estimation Verdict Dashboard & Chart Enhancements

### Task 2.1: EstimationVerdictDashboard Component

**Files:**
- Create: `frontend/src/features/estimation/components/EstimationVerdictDashboard.tsx`
- Modify: `frontend/src/features/estimation/components/EstimationResults.tsx`
- Test: `frontend/src/features/estimation/components/__tests__/EstimationVerdictDashboard.test.tsx`

**Step 1: Write failing test**

```typescript
// frontend/src/features/estimation/components/__tests__/EstimationVerdictDashboard.test.tsx
import { render, screen } from "@testing-library/react";
import { EstimationVerdictDashboard } from "../EstimationVerdictDashboard";

const mockResult = {
  estimates: [
    { outcome_name: "MI", hazard_ratio: 0.72, ci_95_lower: 0.58, ci_95_upper: 0.89, p_value: 0.003, target_outcomes: 45, comparator_outcomes: 62 },
  ],
  summary: { target_count: 5000, comparator_count: 5000 },
  kaplan_meier: {
    target: [{ time: 0, survival: 1 }, { time: 365, survival: 0.91 }],
    comparator: [{ time: 0, survival: 1 }, { time: 365, survival: 0.87 }],
  },
};

describe("EstimationVerdictDashboard", () => {
  it("renders HR value", () => {
    render(<EstimationVerdictDashboard result={mockResult} />);
    expect(screen.getByText("0.720")).toBeInTheDocument();
  });

  it("renders significance verdict badge", () => {
    render(<EstimationVerdictDashboard result={mockResult} />);
    expect(screen.getByText(/significant protective effect/i)).toBeInTheDocument();
  });

  it("renders NNT when KM data available", () => {
    render(<EstimationVerdictDashboard result={mockResult} />);
    expect(screen.getByText(/NNT/)).toBeInTheDocument();
  });

  it("renders CI bar", () => {
    const { container } = render(<EstimationVerdictDashboard result={mockResult} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
```

**Step 2: Run test — expected FAIL**

Run: `cd frontend && npx vitest run src/features/estimation/components/__tests__/EstimationVerdictDashboard.test.tsx`

**Step 3: Implement EstimationVerdictDashboard**

```typescript
// frontend/src/features/estimation/components/EstimationVerdictDashboard.tsx
import { fmt, num, fmtP, computeNNT } from "@/lib/formatters";
import { SignificanceVerdictBadge, MetricCard, CIBar, InterpretationTooltip } from "@/components/charts";
import type { EstimationResult } from "../types/estimation";

interface EstimationVerdictDashboardProps {
  result: EstimationResult;
}

export function EstimationVerdictDashboard({ result }: EstimationVerdictDashboardProps) {
  const primary = result.estimates?.[0];
  if (!primary) return null;

  const hr = num(primary.hazard_ratio);
  const ciLower = num(primary.ci_95_lower);
  const ciUpper = num(primary.ci_95_upper);
  const pVal = num(primary.p_value);

  // Compute NNT from KM data at latest available time point
  let nnt: number | null = null;
  let nntTimepoint = "";
  if (result.kaplan_meier?.target?.length && result.kaplan_meier?.comparator?.length) {
    const targetKm = result.kaplan_meier.target;
    const compKm = result.kaplan_meier.comparator;
    const lastTarget = targetKm[targetKm.length - 1];
    const lastComp = compKm[compKm.length - 1];
    nnt = computeNNT(num(lastTarget.survival), num(lastComp.survival));
    const days = num(lastTarget.time);
    nntTimepoint = days >= 365 ? `${Math.round(days / 365)}yr` : `${days}d`;
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-[#8A857D] uppercase tracking-wider">Primary Outcome: {primary.outcome_name}</p>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="font-mono text-4xl font-bold text-[#F0EDE8]">{fmt(hr)}</span>
            <span className="text-sm text-[#8A857D]">Hazard Ratio</span>
            <InterpretationTooltip
              metric="Hazard Ratio"
              plain="The relative rate of the outcome in the treatment group vs. the comparator. Below 1 means treatment reduces risk."
              technical="HR = hazard(treatment) / hazard(comparator). Estimated via Cox proportional hazards."
            />
          </div>
          <p className="text-sm text-[#5A5650] font-mono mt-1">
            95% CI: {fmt(ciLower)} – {fmt(ciUpper)} | p = {fmtP(pVal)}
          </p>
        </div>
        <SignificanceVerdictBadge hr={hr} pValue={pVal} ciLower={ciLower} ciUpper={ciUpper} />
      </div>

      <CIBar estimate={hr} ciLower={ciLower} ciUpper={ciUpper} className="mb-4" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Target Cohort" value={fmt(num(result.summary?.target_count), 0)} color="teal" />
        <MetricCard label="Comparator Cohort" value={fmt(num(result.summary?.comparator_count), 0)} color="gold" />
        <MetricCard
          label="Target Events"
          value={String(primary.target_outcomes ?? "—")}
          color={hr < 1 ? "teal" : "crimson"}
        />
        {nnt !== null && nnt !== Infinity && (
          <MetricCard
            label={nnt > 0 ? "NNT" : "NNH"}
            value={String(Math.abs(nnt))}
            subtitle={`at ${nntTimepoint}`}
            color={nnt > 0 ? "teal" : "crimson"}
          >
            <InterpretationTooltip
              metric={nnt > 0 ? "NNT" : "NNH"}
              plain={nnt > 0
                ? "Number of patients you need to treat to prevent one additional bad outcome."
                : "Number of patients treated for one additional patient to be harmed."
              }
              technical="NNT = 1 / Absolute Risk Reduction. Computed from Kaplan-Meier survival estimates."
            />
          </MetricCard>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test — expected PASS**

Run: `cd frontend && npx vitest run src/features/estimation/components/__tests__/EstimationVerdictDashboard.test.tsx`

**Step 5: Wire into EstimationResults.tsx**

Modify `frontend/src/features/estimation/components/EstimationResults.tsx`:
- Add import: `import { EstimationVerdictDashboard } from "./EstimationVerdictDashboard";`
- Insert `<EstimationVerdictDashboard result={result} />` as the first child inside the main render block (before the existing summary cards grid)

**Step 6: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

**Step 7: Commit**

```bash
git add frontend/src/features/estimation/
git commit -m "feat: add EstimationVerdictDashboard with HR, NNT, significance verdict"
```

---

### Task 2.2: Forest Plot Enhancements (Prediction Interval, NNT Column, Weight Encoding)

**Files:**
- Modify: `frontend/src/features/estimation/components/ForestPlot.tsx`
- Test: `frontend/src/features/estimation/components/__tests__/ForestPlot.test.tsx`

**Step 1: Write failing test for prediction interval rendering**

```typescript
// frontend/src/features/estimation/components/__tests__/ForestPlot.test.tsx
import { render } from "@testing-library/react";
import { ForestPlot } from "../ForestPlot";

const mockEstimates = [
  { outcome_name: "MI", hazard_ratio: 0.72, ci_95_lower: 0.58, ci_95_upper: 0.89, p_value: 0.003, target_outcomes: 45, comparator_outcomes: 62 },
  { outcome_name: "Stroke", hazard_ratio: 1.15, ci_95_lower: 0.85, ci_95_upper: 1.56, p_value: 0.37, target_outcomes: 30, comparator_outcomes: 26 },
];

describe("ForestPlot", () => {
  it("renders SVG with correct number of estimate rows", () => {
    const { container } = render(<ForestPlot estimates={mockEstimates} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThanOrEqual(2); // one per estimate
  });

  it("renders NNT column when showNNT is true", () => {
    const { container } = render(<ForestPlot estimates={mockEstimates} showNNT />);
    const svg = container.querySelector("svg");
    expect(svg?.textContent).toContain("NNT");
  });

  it("renders weight-encoded squares when weights provided", () => {
    const weighted = mockEstimates.map((e, i) => ({ ...e, weight: i === 0 ? 0.7 : 0.3 }));
    const { container } = render(<ForestPlot estimates={weighted} />);
    const rects = container.querySelectorAll("rect");
    // Should have different sized squares
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });
});
```

**Step 2: Enhance ForestPlot.tsx**

Read current ForestPlot.tsx first. Add the following capabilities:
- Accept optional `showNNT?: boolean` and `showWeights?: boolean` props
- Add NNT/NNH column to the right of p-value labels (width += 80px)
- Size point estimate squares proportionally to `weight` field when present
- Add optional `predictionInterval?: { lower: number; upper: number }` prop — rendered as a dashed line wider than CI on the pooled row

**Step 3: Run tests, commit**

Run: `cd frontend && npx vitest run src/features/estimation/components/__tests__/ForestPlot.test.tsx`

```bash
git add frontend/src/features/estimation/components/ForestPlot.tsx frontend/src/features/estimation/components/__tests__/
git commit -m "feat: enhance ForestPlot with NNT column, weight encoding, prediction interval"
```

---

### Task 2.3: Kaplan-Meier Curve Enhancements (Risk Difference Shading, RMST, Time Cursor)

**Files:**
- Modify: `frontend/src/features/estimation/components/KaplanMeierPlot.tsx`
- Test: `frontend/src/features/estimation/components/__tests__/KaplanMeierPlot.test.tsx`

**Step 1: Write failing test**

```typescript
// frontend/src/features/estimation/components/__tests__/KaplanMeierPlot.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { KaplanMeierPlot } from "../KaplanMeierPlot";

const mockData = {
  target: [
    { time: 0, survival: 1.0 }, { time: 90, survival: 0.95 }, { time: 180, survival: 0.91 }, { time: 365, survival: 0.88 },
  ],
  comparator: [
    { time: 0, survival: 1.0 }, { time: 90, survival: 0.92 }, { time: 180, survival: 0.85 }, { time: 365, survival: 0.80 },
  ],
};

describe("KaplanMeierPlot", () => {
  it("renders risk difference shading when showRiskDifference is true", () => {
    const { container } = render(<KaplanMeierPlot data={mockData} showRiskDifference />);
    const polygons = container.querySelectorAll("polygon");
    expect(polygons.length).toBeGreaterThanOrEqual(1); // risk difference polygon
  });

  it("renders RMST annotation when showRMST is true", () => {
    const { container } = render(<KaplanMeierPlot data={mockData} showRMST />);
    expect(container.textContent).toContain("RMST");
  });
});
```

**Step 2: Enhance KaplanMeierPlot.tsx**

Read current file first. Add:
- `showRiskDifference?: boolean` — renders semi-transparent polygon between the two survival curves
- `showRMST?: boolean` — computes restricted mean survival time via trapezoidal integration, shows annotation
- `interactive?: boolean` — adds mouse-tracking vertical line cursor showing survival probability and risk difference at hover position
- Confidence band toggle via `showCI?: boolean` (default true, existing behavior)

**Step 3: Run tests, commit**

```bash
git add frontend/src/features/estimation/components/KaplanMeierPlot.tsx frontend/src/features/estimation/components/__tests__/
git commit -m "feat: enhance KM curves with risk difference shading, RMST, interactive cursor"
```

---

### Task 2.4: Systematic Error Plot Enhancement (Calibration Overlay)

**Files:**
- Modify: `frontend/src/features/estimation/components/SystematicErrorPlot.tsx`
- Test: `frontend/src/features/estimation/components/__tests__/SystematicErrorPlot.test.tsx`

**Step 1: Write failing test**

```typescript
// frontend/src/features/estimation/components/__tests__/SystematicErrorPlot.test.tsx
import { render } from "@testing-library/react";
import { SystematicErrorPlot } from "../SystematicErrorPlot";

const mockControls = [
  { outcome_name: "NC1", log_rr: 0.05, se: 0.15, calibrated_log_rr: 0.02, calibrated_se: 0.12 },
  { outcome_name: "NC2", log_rr: -0.1, se: 0.2, calibrated_log_rr: -0.05, calibrated_se: 0.18 },
];

describe("SystematicErrorPlot", () => {
  it("renders calibration arrows when calibrated data present", () => {
    const { container } = render(<SystematicErrorPlot negativeControls={mockControls} showCalibration />);
    // Arrows connecting pre to post calibration
    const lines = container.querySelectorAll("line[marker-end]");
    expect(lines.length).toBe(2);
  });
});
```

**Step 2: Enhance SystematicErrorPlot.tsx**

Read current file. Add `showCalibration?: boolean` prop. When true and `calibrated_log_rr`/`calibrated_se` fields exist on negative controls, render:
- Original positions as open circles
- Calibrated positions as filled circles
- Connecting arrows from original to calibrated position
- Legend entry for "Pre-calibration" / "Post-calibration"

**Step 3: Run tests, commit**

```bash
git add frontend/src/features/estimation/components/SystematicErrorPlot.tsx frontend/src/features/estimation/components/__tests__/
git commit -m "feat: add calibration overlay to SystematicErrorPlot"
```

---

## Phase 3: Evidence Synthesis Verdict Dashboard & Heterogeneity Map

### Task 3.1: SiteHeterogeneityMap Component

**Files:**
- Create: `frontend/src/features/evidence-synthesis/components/SiteHeterogeneityMap.tsx`
- Test: `frontend/src/features/evidence-synthesis/components/__tests__/SiteHeterogeneityMap.test.tsx`

**Step 1: Write failing test**

```typescript
// frontend/src/features/evidence-synthesis/components/__tests__/SiteHeterogeneityMap.test.tsx
import { render, screen } from "@testing-library/react";
import { SiteHeterogeneityMap } from "../SiteHeterogeneityMap";

const mockSites = [
  { site_name: "Site A", hr: 0.72, ci_lower: 0.55, ci_upper: 0.94, weight: 0.35 },
  { site_name: "Site B", hr: 1.10, ci_lower: 0.80, ci_upper: 1.51, weight: 0.25 },
  { site_name: "Site C", hr: 0.65, ci_lower: 0.48, ci_upper: 0.88, weight: 0.40 },
];

describe("SiteHeterogeneityMap", () => {
  it("renders one bubble per site", () => {
    const { container } = render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.78} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(3);
  });

  it("renders null reference line", () => {
    const { container } = render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.78} />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it("shows site name on hover", async () => {
    render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.78} />);
    // Verify aria labels exist for accessibility
    expect(screen.getByLabelText(/Site A/)).toBeInTheDocument();
  });
});
```

**Step 2: Implement SiteHeterogeneityMap**

Custom SVG bubble strip plot:
- X-axis: log(HR) scale
- Bubbles sized by weight, colored by direction (teal <1, red >1, gray spans null)
- Vertical line at HR=1 (gold dashed) and pooled HR (gold diamond)
- Hover tooltip with site details
- Width 700, height 200

**Step 3: Run tests, commit**

```bash
git add frontend/src/features/evidence-synthesis/components/SiteHeterogeneityMap.tsx frontend/src/features/evidence-synthesis/components/__tests__/
git commit -m "feat: add SiteHeterogeneityMap for cross-site heterogeneity visualization"
```

---

### Task 3.2: EvidenceSynthesisVerdictDashboard Component

**Files:**
- Create: `frontend/src/features/evidence-synthesis/components/EvidenceSynthesisVerdictDashboard.tsx`
- Modify: `frontend/src/features/evidence-synthesis/components/EvidenceSynthesisResults.tsx`
- Test: `frontend/src/features/evidence-synthesis/components/__tests__/EvidenceSynthesisVerdictDashboard.test.tsx`

**Step 1: Write failing test**

```typescript
import { render, screen } from "@testing-library/react";
import { EvidenceSynthesisVerdictDashboard } from "../EvidenceSynthesisVerdictDashboard";

const mockResult = {
  pooled: { hr: 0.78, ci_lower: 0.65, ci_upper: 0.93, tau: 0.12, log_rr: -0.25, se_log_rr: 0.09 },
  per_site: [
    { site_name: "Site A", hr: 0.72, ci_lower: 0.55, ci_upper: 0.94, log_rr: -0.33, se_log_rr: 0.14 },
    { site_name: "Site B", hr: 1.10, ci_lower: 0.80, ci_upper: 1.51, log_rr: 0.10, se_log_rr: 0.16 },
    { site_name: "Site C", hr: 0.65, ci_lower: 0.48, ci_upper: 0.88, log_rr: -0.43, se_log_rr: 0.15 },
  ],
  method: "bayesian",
};

describe("EvidenceSynthesisVerdictDashboard", () => {
  it("renders pooled HR", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText("0.780")).toBeInTheDocument();
  });

  it("renders heterogeneity label", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    // I² computed from tau and per-site data
    expect(screen.getByText(/heterogeneity/i)).toBeInTheDocument();
  });

  it("renders site agreement indicator", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText(/2 of 3 sites/i)).toBeInTheDocument();
  });

  it("renders site heterogeneity map", () => {
    const { container } = render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    // Should have bubbles from the SiteHeterogeneityMap
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(3);
  });
});
```

**Step 2: Implement, wire into EvidenceSynthesisResults.tsx, test, commit**

```bash
git add frontend/src/features/evidence-synthesis/
git commit -m "feat: add EvidenceSynthesisVerdictDashboard with heterogeneity map and site agreement"
```

---

### Task 3.3: Evidence Synthesis Forest Plot Enhancements

**Files:**
- Modify: `frontend/src/features/evidence-synthesis/components/ForestPlot.tsx`

Add prediction interval diamond, weight % column, leave-one-out sensitivity markers.

```bash
git commit -m "feat: enhance evidence synthesis ForestPlot with prediction interval, weights, LOO markers"
```

---

## Phase 4: Incidence Rate Verdict Dashboard & Enhancements

### Task 4.1: IncidenceRateVerdictDashboard Component

**Files:**
- Create: `frontend/src/features/analyses/components/IncidenceRateVerdictDashboard.tsx`
- Modify: `frontend/src/features/analyses/components/IncidenceRateResults.tsx`
- Test: `frontend/src/features/analyses/components/__tests__/IncidenceRateVerdictDashboard.test.tsx`

Features:
- Comparative IR card with side-by-side rates
- Rate Difference (IRD) with CI
- Rate Ratio (IRR) with CI
- Significance verdict badge
- Stratified comparison panel (small multiples) when strata exist

```bash
git commit -m "feat: add IncidenceRateVerdictDashboard with rate difference, stratified comparisons"
```

---

### Task 4.2: Incidence Rate Forest Plot & Table Enhancements

**Files:**
- Modify: `frontend/src/features/analyses/components/IncidenceRateResults.tsx`

- Dual-scale toggle (Rate Ratio vs Rate Difference)
- Sparkline trend column in summary table
- CI width precision indicator
- Gradient background on IR cells
- Sortable columns

```bash
git commit -m "feat: enhance IR forest plot with dual-scale toggle, sparklines, precision indicators"
```

---

## Phase 5: Prediction Verdict Dashboard & Chart Enhancements

### Task 5.1: PredictionVerdictDashboard Component

**Files:**
- Create: `frontend/src/features/prediction/components/PredictionVerdictDashboard.tsx`
- Modify: `frontend/src/features/prediction/components/PredictionResults.tsx`
- Test: `frontend/src/features/prediction/components/__tests__/PredictionVerdictDashboard.test.tsx`

Features:
- Model Performance Scorecard with traffic-light badges (AUC, Brier, calibration)
- Overall verdict badge ("Ready for validation", "Needs recalibration", "Insufficient discrimination")
- Clinical utility threshold selector (slider updating sensitivity/specificity/PPV/NPV/NNS)

```bash
git commit -m "feat: add PredictionVerdictDashboard with traffic-light scorecard and threshold selector"
```

---

### Task 5.2: ROC Curve, Calibration Plot, Net Benefit Enhancements

**Files:**
- Modify: `frontend/src/features/prediction/components/RocCurve.tsx`
- Modify: `frontend/src/features/prediction/components/CalibrationPlot.tsx`
- Modify: `frontend/src/features/prediction/components/NetBenefitCurve.tsx`
- Modify: `frontend/src/features/prediction/components/PredictionDistribution.tsx`

ROC: Youden's J marker, interactive cursor, CI band, validation overlay
Calibration: decile histogram marginal, Loess line, ICI/E-max
Net Benefit: shaded benefit region, crossover labels
Distribution: overlapping histograms, draggable threshold

```bash
git commit -m "feat: enhance prediction charts — ROC Youden's J, calibration ICI, net benefit shading"
```

---

## Phase 6: SCCS Verdict Dashboard & Enhancements

### Task 6.1: SccsVerdictDashboard Component

**Files:**
- Create: `frontend/src/features/sccs/components/SccsVerdictDashboard.tsx`
- Modify: `frontend/src/features/sccs/components/SccsResults.tsx`
- Test: `frontend/src/features/sccs/components/__tests__/SccsVerdictDashboard.test.tsx`

Features:
- Risk window summary card (IRR, absolute excess risk, pre-exposure trend pass/fail)
- Multi-window comparison strip with IRR badges
- Pattern flagging (elevated pre-exposure, carryover, dose-response)

```bash
git commit -m "feat: add SccsVerdictDashboard with risk window summary and pre-exposure trend test"
```

---

### Task 6.2: SCCS Timeline & Table Enhancements

**Files:**
- Modify: `frontend/src/features/estimation/components/SccsTimeline.tsx`
- Modify: `frontend/src/features/sccs/components/SccsResults.tsx`

Timeline: height-encoded IRR blocks, CI whiskers, event density overlay, interactive hover
Table: inline mini forest plots, sort by magnitude, precision warnings

```bash
git commit -m "feat: enhance SCCS timeline with IRR magnitude encoding, event density, interactive hover"
```

---

## Phase 7: Characterization Verdict Dashboard & Enhancements

### Task 7.1: CharacterizationVerdictDashboard Component

**Files:**
- Create: `frontend/src/features/analyses/components/CharacterizationVerdictDashboard.tsx`
- Modify: `frontend/src/features/analyses/components/CharacterizationResults.tsx`
- Test: `frontend/src/features/analyses/components/__tests__/CharacterizationVerdictDashboard.test.tsx`

Features:
- Balance summary card (verdict, metric strip, before/after comparison)
- Top imbalanced covariates spotlight (diverging horizontal bars)

```bash
git commit -m "feat: add CharacterizationVerdictDashboard with balance summary and imbalance spotlight"
```

---

### Task 7.2: Love Plot & Feature Table Enhancements

**Files:**
- Modify: `frontend/src/features/estimation/components/LovePlot.tsx`
- Modify: `frontend/src/features/analyses/components/CharacterizationResults.tsx`

Love Plot: density marginal, quadrant shading, interactive brush, before/after animation
Table: heatmap mode toggle, domain grouping, export-friendly view

```bash
git commit -m "feat: enhance Love Plot with density marginal, brush selection, domain grouping"
```

---

## Phase 8: Cross-Cutting Features

### Task 8.1: Chart Export (SVG/PNG)

**Files:**
- Create: `frontend/src/components/charts/ChartExportButton.tsx`
- Test: `frontend/src/components/charts/__tests__/ChartExportButton.test.tsx`

One-click SVG/PNG export button that wraps any SVG chart. Uses canvas API for PNG conversion. Includes white-background option for publications.

```bash
git commit -m "feat: add ChartExportButton for SVG/PNG export of any chart"
```

---

### Task 8.2: Print/Publication Mode Toggle

**Files:**
- Create: `frontend/src/components/charts/PrintModeToggle.tsx`
- Create: `frontend/src/stores/printModeStore.ts`

Zustand store for print mode state. Toggle switches all chart components to white bg, black text, print-optimized spacing via CSS class on results container.

```bash
git commit -m "feat: add print/publication mode toggle for journal-ready charts"
```

---

### Task 8.3: Copy Summary Button

**Files:**
- Create: `frontend/src/components/charts/CopySummaryButton.tsx`

Generates plain-text statistical summary from result data and copies to clipboard. Format varies by analysis type.

```bash
git commit -m "feat: add CopySummaryButton for clipboard statistical summaries"
```

---

### Task 8.4: Wire Cross-Cutting Components Into All Results Pages

**Files:**
- Modify: `frontend/src/features/estimation/components/EstimationResults.tsx`
- Modify: `frontend/src/features/evidence-synthesis/components/EvidenceSynthesisResults.tsx`
- Modify: `frontend/src/features/analyses/components/IncidenceRateResults.tsx`
- Modify: `frontend/src/features/prediction/components/PredictionResults.tsx`
- Modify: `frontend/src/features/sccs/components/SccsResults.tsx`
- Modify: `frontend/src/features/analyses/components/CharacterizationResults.tsx`

Add export buttons, print mode toggle, and copy summary to all 6 results pages. Place in a consistent toolbar above the verdict dashboard.

```bash
git commit -m "feat: wire export, print mode, and copy summary into all 6 results pages"
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1.1–1.3 | Shared primitives, utilities, infrastructure |
| 2 | 2.1–2.4 | Estimation verdict dashboard + chart enhancements |
| 3 | 3.1–3.3 | Evidence synthesis verdict dashboard + heterogeneity map |
| 4 | 4.1–4.2 | Incidence rate verdict dashboard + enhancements |
| 5 | 5.1–5.2 | Prediction verdict dashboard + chart enhancements |
| 6 | 6.1–6.2 | SCCS verdict dashboard + enhancements |
| 7 | 7.1–7.2 | Characterization verdict dashboard + enhancements |
| 8 | 8.1–8.4 | Cross-cutting: export, print mode, copy summary |

**Total:** 8 phases, 19 tasks, ~40 new/modified files
**Dependencies:** Phase 1 first, then Phases 2–7 can be parallelized, Phase 8 last
