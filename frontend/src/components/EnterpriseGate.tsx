import type { ReactNode } from "react";

import { useFlag } from "@/stores/featureFlagsStore";
import type { FlagName } from "@/types/featureFlags";

import { EnterpriseBadge } from "./EnterpriseBadge";

interface EnterpriseGateProps {
  /** The feature flag this gate is keyed on. */
  flag: FlagName;
  /** Rendered when the flag is `enabled === true`. */
  children: ReactNode;
  /** Rendered when the flag is off. Defaults to `null` (renders nothing). */
  fallback?: ReactNode;
  /**
   * "See what you're missing" mode for marketing surfaces. Children render
   * dimmed and non-interactive, with an Enterprise badge overlay. Default
   * `false` (hide entirely).
   */
  showAsLocked?: boolean;
}

/**
 * Conditionally renders children based on a server-resolved feature flag.
 *
 * CE deployments — every EE flag is off, so `<EnterpriseGate>` renders the
 * fallback (or nothing) for EE-only surfaces. EE deployments — flags are
 * flipped server-side; the gate reveals the children.
 *
 * Usage:
 *   <EnterpriseGate flag="auth.saml">
 *     <SamlConfigForm />
 *   </EnterpriseGate>
 *
 *   <EnterpriseGate flag="auth.saml" showAsLocked>
 *     <SamlConfigForm />   // dimmed, non-interactive, badged
 *   </EnterpriseGate>
 */
export function EnterpriseGate({
  flag,
  children,
  fallback = null,
  showAsLocked = false,
}: EnterpriseGateProps) {
  const enabled = useFlag(flag);
  if (enabled) {
    return <>{children}</>;
  }
  if (showAsLocked) {
    return (
      <div
        data-testid={`gate-locked-${flag}`}
        className="relative pointer-events-none opacity-50"
        aria-disabled
      >
        <div className="absolute right-2 top-2 z-10 pointer-events-auto">
          <EnterpriseBadge />
        </div>
        {children}
      </div>
    );
  }
  return <>{fallback}</>;
}
