interface EnterpriseBadgeProps {
  className?: string;
}

/**
 * "Enterprise Edition" pill. Shown inside locked-mode `<EnterpriseGate>` so
 * users see what features exist in the EE overlay without the surface being
 * interactive. Visual treatment uses the gold/amber accent from the
 * Parthenon clinical theme.
 */
export function EnterpriseBadge({ className = "" }: EnterpriseBadgeProps) {
  return (
    <span
      data-testid="enterprise-badge"
      className={`inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30 ${className}`.trim()}
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 1L2 4v4c0 4 3 6 6 7 3-1 6-3 6-7V4l-6-3z" />
      </svg>
      Enterprise
    </span>
  );
}
