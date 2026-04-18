import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Server,
  Globe,
  FileKey,
  Fingerprint,
  ChevronDown,
  ChevronUp,
  Loader2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  useAuthProviders,
  useToggleAuthProvider,
  useUpdateAuthProvider,
  useTestAuthProvider,
} from "@/features/administration/hooks/useAuthProviders";
import { LdapConfigForm } from "@/features/administration/components/LdapConfigForm";
import { OAuth2ConfigForm } from "@/features/administration/components/OAuth2ConfigForm";
import { Saml2ConfigForm } from "@/features/administration/components/Saml2ConfigForm";
import { OidcConfigForm } from "@/features/administration/components/OidcConfigForm";
import type { AuthProviderSetting, AuthProviderType } from "@/types/models";
import type { TestResult } from "@/features/administration/api/adminApi";
import { cn } from "@/lib/utils";

interface ConfigFormProps {
  settings: AuthProviderSetting["settings"];
  onSave: (settings: Record<string, unknown>) => void;
  isPending: boolean;
  saveSuccess: boolean;
}

interface Props {
  onConfigured: () => void;
}

const META: Record<
  AuthProviderType,
  { labelKey: string; icon: LucideIcon; descriptionKey: string; color: string }
> = {
  ldap: {
    labelKey: "setup.authentication.providers.ldap.label",
    icon: Server,
    descriptionKey: "setup.authentication.providers.ldap.description",
    color: "text-blue-500",
  },
  oauth2: {
    labelKey: "setup.authentication.providers.oauth2.label",
    icon: Globe,
    descriptionKey: "setup.authentication.providers.oauth2.description",
    color: "text-green-500",
  },
  saml2: {
    labelKey: "setup.authentication.providers.saml2.label",
    icon: FileKey,
    descriptionKey: "setup.authentication.providers.saml2.description",
    color: "text-purple-500",
  },
  oidc: {
    labelKey: "setup.authentication.providers.oidc.label",
    icon: Fingerprint,
    descriptionKey: "setup.authentication.providers.oidc.description",
    color: "text-amber-500",
  },
};

const CONFIG_FORMS: Record<AuthProviderType, React.ComponentType<{
  settings: AuthProviderSetting["settings"];
  onSave: (settings: Record<string, unknown>) => void;
  isPending: boolean;
  saveSuccess: boolean;
}>> = {
  ldap: LdapConfigForm as React.ComponentType<ConfigFormProps>,
  oauth2: OAuth2ConfigForm as React.ComponentType<ConfigFormProps>,
  saml2: Saml2ConfigForm as React.ComponentType<ConfigFormProps>,
  oidc: OidcConfigForm as React.ComponentType<ConfigFormProps>,
};

function ProviderCard({
  provider,
  onEnabled,
}: {
  provider: AuthProviderSetting;
  onEnabled: () => void;
}) {
  const { t } = useTranslation("auth");
  const meta = META[provider.provider_type];
  const Icon = meta.icon;
  const ConfigForm = CONFIG_FORMS[provider.provider_type];

  const [open, setOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggle = useToggleAuthProvider();
  const update = useUpdateAuthProvider();
  const test = useTestAuthProvider();

  const handleToggle = (enable: boolean) => {
    toggle.mutate(
      { type: provider.provider_type, enable },
      { onSuccess: () => { if (enable) onEnabled(); } },
    );
  };

  const handleSave = (settings: Record<string, unknown>) => {
    setSaveSuccess(false);
    update.mutate(
      { type: provider.provider_type, data: { settings: settings as unknown as AuthProviderSetting["settings"] } },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        },
      },
    );
  };

  const handleTest = () => {
    setTestResult(null);
    test.mutate(provider.provider_type, { onSuccess: setTestResult });
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-overlay overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-surface-elevated", meta.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-text-primary">{t(meta.labelKey)}</p>
            <p className="text-xs text-text-muted">{t(meta.descriptionKey)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          {/* Toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-xs text-text-muted">
              {provider.is_enabled
                ? t("setup.authentication.enabled")
                : t("setup.authentication.disabled")}
            </span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={provider.is_enabled}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              <div
                className={cn(
                  "h-5 w-9 rounded-full transition-colors",
                  provider.is_enabled ? "bg-accent" : "bg-surface-highlight",
                )}
              />
              <div
                className={cn(
                  "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  provider.is_enabled ? "translate-x-4" : "",
                )}
              />
            </div>
          </label>

          {/* Configure expand */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 rounded-md border border-border-default px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-elevated"
          >
            {t("setup.authentication.configure")}{" "}
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Collapsible config */}
      {open && (
        <div className="border-t border-border-default px-5 pb-5 pt-4">
          <ConfigForm
            settings={provider.settings}
            onSave={handleSave}
            isPending={update.isPending}
            saveSuccess={saveSuccess}
          />

          {/* Test connection (LDAP, OIDC only) */}
          {["ldap", "oidc"].includes(provider.provider_type) && (
            <div className="mt-4 border-t border-border-default pt-4">
              <button
                onClick={handleTest}
                disabled={test.isPending}
                className="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-text-muted hover:bg-surface-elevated disabled:opacity-50"
              >
                {test.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
                {t("setup.authentication.testConnection")}
              </button>
              {testResult && (
                <div
                  className={cn(
                    "mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm",
                    testResult.success
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400",
                  )}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">
                      {testResult.success
                        ? t("setup.authentication.connectionSuccessful")
                        : t("setup.authentication.connectionFailed")}
                    </p>
                    <p className="mt-0.5 text-xs opacity-80">{testResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AuthenticationStep({ onConfigured }: Props) {
  const { t } = useTranslation("auth");
  const { data: providers, isLoading } = useAuthProviders();
  const ordered = [...(providers ?? [])].sort((a, b) => a.priority - b.priority);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="ml-2 text-sm text-text-muted">
          {t("setup.authentication.loading")}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">
          {t("setup.authentication.title")}
        </h3>
        <p className="text-sm text-text-muted">
          {t("setup.authentication.intro")}
        </p>
      </div>

      {/* Built-in auth banner */}
      <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-overlay px-5 py-4 opacity-70">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-elevated text-accent">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-text-primary">
            {t("setup.authentication.usernamePassword")}
          </p>
          <p className="text-xs text-text-muted">
            {t("setup.authentication.builtIn")}
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
          {t("setup.authentication.alwaysOn")}
        </span>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {ordered.map((p) => (
          <ProviderCard key={p.provider_type} provider={p} onEnabled={onConfigured} />
        ))}
      </div>
    </div>
  );
}
