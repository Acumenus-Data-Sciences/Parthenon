import { useNavigate } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import type { ToolsetDescriptor } from "../types";

function getIcon(name: string): React.ElementType {
  const icons = LucideIcons as unknown as Record<string, React.ElementType>;
  return icons[name] ?? LucideIcons.Box;
}

interface ToolsetCardProps {
  toolset: ToolsetDescriptor;
}

export function ToolsetCard({ toolset }: ToolsetCardProps) {
  const navigate = useNavigate();
  const Icon = getIcon(toolset.icon);
  const isClickable = toolset.status === "available" && toolset.route;

  return (
    <button
      type="button"
      onClick={() => {
        if (isClickable && toolset.route) navigate(toolset.route);
      }}
      disabled={!isClickable}
      className={`group relative flex flex-col gap-4 rounded-2xl border p-6 text-left transition-all duration-200 ${
        isClickable
          ? "cursor-pointer border-zinc-700/60 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900/80 hover:shadow-lg"
          : "cursor-default border-zinc-800/40 bg-zinc-950/30 opacity-60"
      }`}
      style={
        isClickable
          ? ({ "--card-accent": toolset.accent } as React.CSSProperties)
          : undefined
      }
    >
      {/* Accent glow on hover */}
      {isClickable && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            boxShadow: `inset 0 0 0 1px ${toolset.accent}40, 0 0 20px ${toolset.accent}10`,
          }}
        />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${toolset.accent}15` }}
        >
          <Icon
            className="h-6 w-6"
            style={{ color: toolset.accent } as React.CSSProperties}
          />
        </div>
        {toolset.badge && (
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {toolset.badge}
          </span>
        )}
      </div>

      {/* Name + tagline */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">{toolset.name}</h3>
        <p className="mt-1 text-sm text-zinc-400">{toolset.tagline}</p>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed text-zinc-500">
        {toolset.description}
      </p>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2">
        {toolset.status === "available" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Available
          </span>
        ) : toolset.status === "coming_soon" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Coming Soon
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            SDK Required
          </span>
        )}
        {isClickable && (
          <LucideIcons.ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400" />
        )}
      </div>
    </button>
  );
}
