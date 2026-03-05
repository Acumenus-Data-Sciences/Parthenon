import { useState } from "react";
import {
  Server, Globe, FileKey, Fingerprint,
  ChevronDown, ChevronUp, CheckCircle2, XCircle,
  Loader2, FlaskConical,
} from "lucide-react";
import { Panel, Badge, Button } from "@/components/ui";
import { useAuthProviders, useToggleAuthProvider, useUpdateAuthProvider, useTestAuthProvider } from "../hooks/useAuthProviders";
import { LdapConfigForm } from "../components/LdapConfigForm";
import { OAuth2ConfigForm } from "../components/OAuth2ConfigForm";
import { Saml2ConfigForm } from "../components/Saml2ConfigForm";
import { OidcConfigForm } from "../components/OidcConfigForm";
import type { AuthProviderSetting, AuthProviderType } from "@/types/models";
import type { TestResult } from "../api/adminApi";

const META: Record<AuthProviderType, {
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
}> = {
  ldap: {
    label: "LDAP / Active Directory",
    icon: Server,
    description: "Authenticate against Microsoft Active Directory or any LDAP v3 directory. Supports TLS, group sync, and attribute mapping.",
    color: "text-blue-500",
  },
  oauth2: {
    label: "OAuth 2.0",
    icon: Globe,
    description: "Delegate authentication to GitHub, Google, Microsoft, or any custom OAuth 2.0 provider.",
    color: "text-green-500",
  },
  saml2: {
    label: "SAML 2.0",
    icon: FileKey,
    description: "Enterprise SSO via a SAML 2.0 Identity Provider (Okta, Azure AD, ADFS, etc.).",
    color: "text-purple-500",
  },
  oidc: {
    label: "OpenID Connect",
    icon: Fingerprint,
    description: "Modern SSO via OIDC discovery. Supports PKCE and any standards-compliant IdP.",
    color: "text-amber-500",
  },
};

function TestResultBadge({ result }: { result: TestResult }) {
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
        result.success
          ? "bg-green-500/10 text-green-700"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {result.success ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>
        <p className="font-medium">{result.success ? "Connection successful" : "Connection failed"}</p>
        <p className="mt-0.5 text-xs opacity-80">{result.message}</p>
        {result.details && (
          <pre className="mt-2 text-xs opacity-70 whitespace-pre-wrap">
            {JSON.stringify(result.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: AuthProviderSetting }) {
  const meta = META[provider.provider_type];
  const [open, setOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggle = useToggleAuthProvider();
  const update = useUpdateAuthProvider();
  const test = useTestAuthProvider();

  const handleSave = (settings: Record<string, unknown>) => {
    setSaveSuccess(false);
    update.mutate(
      { type: provider.provider_type, data: { settings: settings as unknown as AuthProviderSetting["settings"] } },
      { onSuccess: () => { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); } },
    );
  };

  const handleTest = () => {
    setTestResult(null);
    test.mutate(provider.provider_type, { onSuccess: setTestResult });
  };

  const ConfigForm = {
    ldap:   LdapConfigForm,
    oauth2: OAuth2ConfigForm,
    saml2:  Saml2ConfigForm,
    oidc:   OidcConfigForm,
  }[provider.provider_type];

  return (
    <Panel>
      {/* Card header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${meta.color}`}>
            <meta.icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{meta.label}</p>
              <Badge variant={provider.is_enabled ? "success" : "inactive"}>
                {provider.is_enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          {/* Enable / Disable toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={provider.is_enabled}
                onChange={(e) =>
                  toggle.mutate({ type: provider.provider_type, enable: e.target.checked })
                }
              />
              <div
                className={`h-5 w-9 rounded-full transition-colors ${
                  provider.is_enabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
              <div
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  provider.is_enabled ? "translate-x-4" : ""
                }`}
              />
            </div>
          </label>

          {/* Expand / collapse */}
          <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
            Configure {open ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Collapsible config form */}
      {open && (
        <div className="border-t border-border mt-4 pt-4">
          <ConfigForm
            settings={provider.settings as never}
            onSave={handleSave}
            isPending={update.isPending}
            saveSuccess={saveSuccess}
          />

          {/* Test connection */}
          {["ldap", "oidc"].includes(provider.provider_type) && (
            <div className="mt-4 border-t border-border pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTest}
                disabled={test.isPending}
              >
                {test.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <FlaskConical className="h-4 w-4 mr-1" />
                )}
                Test Connection
              </Button>
              {testResult && <TestResultBadge result={testResult} />}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function AuthProvidersPage() {
  const { data: providers, isLoading } = useAuthProviders();

  const ordered = [...(providers ?? [])].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Authentication Providers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable one or more external identity providers for single sign-on. Sanctum
          username/password is always available as a fallback.
        </p>
      </div>

      {/* Sanctum (always-on) */}
      <Panel className="opacity-70">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">Username &amp; Password</p>
              <Badge variant="success">Always on</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Built-in Sanctum authentication — always active.
            </p>
          </div>
        </div>
      </Panel>

      {isLoading ? (
        <p className="text-muted-foreground">Loading providers…</p>
      ) : (
        <div className="space-y-4">
          {ordered.map((p) => <ProviderCard key={p.provider_type} provider={p} />)}
        </div>
      )}
    </div>
  );
}
