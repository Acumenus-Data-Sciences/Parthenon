import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TemplateNode,
  TemplateRunStatus,
} from "../../../types/templates";

type StepState = "completed" | "active" | "pending" | "failed";

export interface RunDagViewProps {
  nodes: TemplateNode[];
  currentNode: string | null;
  status: TemplateRunStatus;
}

function stateOf(
  index: number,
  currentIndex: number,
  status: TemplateRunStatus,
): StepState {
  if (status === "completed") return "completed";
  if (status === "failed" && index === currentIndex) return "failed";
  if (currentIndex === -1) return "pending";
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "active";
  return "pending";
}

export function RunDagView({ nodes, currentNode, status }: RunDagViewProps) {
  const currentIndex =
    currentNode !== null ? nodes.findIndex((n) => n.id === currentNode) : -1;

  return (
    <div className="flex items-center justify-between w-full px-4 py-6">
      {nodes.map((node, index) => {
        const state = stateOf(index, currentIndex, status);
        const isLast = index === nodes.length - 1;
        return (
          <div
            key={node.id}
            className="flex items-center flex-1 last:flex-none"
          >
            <div className="flex flex-col items-center gap-2">
              <div
                data-node={node.id}
                data-state={state}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all shrink-0",
                  state === "completed" && "bg-success text-surface-base",
                  state === "active" &&
                    "bg-primary text-primary-foreground animate-pulse",
                  state === "pending" &&
                    "border-2 border-surface-highlight text-text-ghost bg-transparent",
                  state === "failed" && "bg-critical text-white",
                )}
              >
                {state === "completed" ? (
                  <Check size={16} strokeWidth={3} />
                ) : state === "failed" ? (
                  <X size={16} strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  state === "completed" && "text-success",
                  state === "active" && "text-text-primary",
                  state === "pending" && "text-text-ghost",
                  state === "failed" && "text-critical",
                )}
              >
                {node.id}
              </span>
              <span className="text-[10px] text-text-ghost">{node.kind}</span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-3 mt-[-1.75rem]">
                <div
                  className={cn(
                    "h-[2px] w-full rounded-full",
                    index < currentIndex || status === "completed"
                      ? "bg-success"
                      : "bg-surface-highlight",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
