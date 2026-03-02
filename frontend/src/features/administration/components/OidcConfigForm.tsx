import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { OidcSettings } from "@/types/models";

interface Props {
  settings: OidcSettings;
  onSave: (s: Record<string, unknown>) => void;
  isPending: boolean;
  saveSuccess: boolean;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground/70">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Inp({ value, onChange, type = "text", placeholder = "" }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

export function OidcConfigForm({ settings, onSave, isPending, saveSuccess }: Props) {
  const [s, setS] = useState<OidcSettings>({ ...settings });
  const set = <K extends keyof OidcSettings>(k: K, v: OidcSettings[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <Field label="Discovery URL" hint="The /.well-known/openid-configuration endpoint of your IdP">
        <Inp
          value={s.discovery_url}
          onChange={(v) => set("discovery_url", v)}
          placeholder="https://accounts.google.com/.well-known/openid-configuration"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client ID">
          <Inp value={s.client_id} onChange={(v) => set("client_id", v)} placeholder="your-client-id" />
        </Field>
        <Field label="Client Secret">
          <Inp value={s.client_secret} onChange={(v) => set("client_secret", v)} type="password" placeholder="••••••••" />
        </Field>
      </div>

      <Field label="Redirect URI" hint="Must match what is registered in your IdP">
        <Inp value={s.redirect_uri} onChange={(v) => set("redirect_uri", v)} placeholder="/api/v1/auth/oidc/callback" />
      </Field>

      <Field label="Scopes" hint="Space-separated">
        <Inp
          value={s.scopes.join(" ")}
          onChange={(v) => set("scopes", v.split(/\s+/).filter(Boolean))}
          placeholder="openid profile email"
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={s.pkce_enabled}
          onChange={(e) => set("pkce_enabled", e.target.checked)}
          className="accent-primary"
        />
        Enable PKCE (recommended — requires public client)
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => onSave(s as unknown as Record<string, unknown>)}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {saveSuccess && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
