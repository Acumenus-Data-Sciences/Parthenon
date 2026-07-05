import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

export type VvStatus = "pass" | "present" | "na" | "missing";

export interface VvCheck {
  requirement: string;
  status: VvStatus;
  evidence: string;
}

const STATUS_META: Record<VvStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pass: { label: "PASS", cls: "text-success", Icon: CheckCircle2 },
  present: { label: "PRESENT", cls: "text-info", Icon: CheckCircle2 },
  na: { label: "N/A", cls: "text-text-ghost", Icon: CircleDashed },
  missing: { label: "MISSING", cls: "text-critical", Icon: XCircle },
};

/**
 * Verification & Validation acceptance matrix (CLAUDE_PROMPT_v5 §8). Pure
 * presentation — the report tab derives each row's status from the available
 * result diagnostics.
 */
export function VvAcceptanceMatrix({ checks }: { checks: VvCheck[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-ghost text-left">
            <th className="py-1 pr-3 font-medium">Requirement</th>
            <th className="py-1 pr-3 font-medium">Status</th>
            <th className="py-1 font-medium">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c, i) => {
            const meta = STATUS_META[c.status];
            const Icon = meta.Icon;
            return (
              <tr key={i} className="border-t border-border-default align-top">
                <td className="py-1.5 pr-3 text-text-secondary">{c.requirement}</td>
                <td className="py-1.5 pr-3">
                  <span className={`inline-flex items-center gap-1 font-semibold ${meta.cls}`}>
                    <Icon size={12} /> {meta.label}
                  </span>
                </td>
                <td className="py-1.5 text-text-muted">{c.evidence}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
