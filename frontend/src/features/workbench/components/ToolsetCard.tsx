import { useNavigate } from "react-router-dom";
import type { LucideProps } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { ToolsetDescriptor } from "../types";

type IconComponent = React.ComponentType<LucideProps>;

function getIcon(name: string): IconComponent {
  const icons = LucideIcons as unknown as Record<string, IconComponent>;
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
          ? "cursor-pointer border-border-default/60 bg-surface-base/50 hover:border-border-hover hover:bg-surface-base/80 hover:shadow-lg"
          : "cursor-default border-border-default/40 bg-surface-darkest/30 opacity-60"
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
            style={{ color: toolset.accent }}
          />
        </div>
        {toolset.badge && (
          <span className="rounded-full border border-border-default bg-surface-raised px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {toolset.badge}
          </span>
        )}
      </div>

      {/* Name + tagline */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{toolset.name}</h3>
        <p className="mt-1 text-sm text-text-muted">{toolset.tagline}</p>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed text-text-ghost">
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
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-ghost">
            <span className="h-1.5 w-1.5 rounded-full bg-surface-overlay" />
            SDK Required
          </span>
        )}
        {isClickable && (
          <LucideIcons.ArrowRight className="h-4 w-4 text-text-ghost transition-transform group-hover:translate-x-1 group-hover:text-text-muted" />
        )}
      </div>
    </button>
  );
}
