// Plan 02-06 — typed registry of deployment-level feature flags.
//
// R6 (Cross-Plan Revision): the FlagName union must be CLOSED so that
// `useFlag('typo')` is a compile error and IDE autocomplete works. EE
// extends the registry via TypeScript module augmentation in:
//
//   enterprise/frontend/src/types/featureFlags.d.ts
//
//   declare module "@/types/featureFlags" {
//     interface FlagNameRegistry {
//       "auth.keycloak-step-up": true;
//       "auth.saml-step-up": true;
//     }
//   }
//
// CE consumers see the closed union below; EE consumers see the augmented
// union after `tsc` merges the declaration.

export interface FlagNameRegistry {
  "auth.saml": true;
  "auth.scim": true;
  "auth.keycloak": true;
  "tenancy.multi": true;
  "audit.signed": true;
  "observability.datadog": true;
  "observability.splunk": true;
  "observability.opentelemetry": true;
  "crypto.fips": true;
  "operator.k8s": true;
  "publish.agent": true;
}

export type FlagName = keyof FlagNameRegistry;

/**
 * Deployment-level feature flag, as returned by
 * `GET /api/v1/system/feature-flags`.
 */
export interface FeatureFlag {
  name: FlagName;
  enabled: boolean;
  source: "ce" | "ee" | "config" | "license";
  description: string | null;
}

/**
 * Map of flag-name -> the flag descriptor. Partial because most flags are
 * absent on a CE deployment.
 */
export type FeatureFlagMap = Partial<Record<FlagName, FeatureFlag>>;
