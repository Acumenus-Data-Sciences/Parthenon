import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { OAuth2Settings } from "@/types/models";

const DRIVERS = [
  { value: "github",    label: "GitHub" },
  { value: "google",    label: "Google" },
  { value: "microsoft", label: "Microsoft / Azure AD" },
  { value: "custom",    label: "Custom OAuth 2.0" },
] as const;

interface Props {
  settings: OAuth2Settings;
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

export function OAuth2ConfigForm({ settings, onSave, isPending, saveSuccess }: Props) {
  const [s, setS] = useState<OAuth2Settings>({ ...settings });
  const set = <K extends keyof OAuth2Settings>(k: K, v: OAuth2Settings[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <Field label="Provider">
        <select
          value={s.driver}
          onChange={(e) => set("driver", e.target.value as OAuth2Settings["driver"])}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {DRIVERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client ID">
          <Inp value={s.client_id} onChange={(v) => set("client_id", v)} placeholder="Client / Application ID" />
        </Field>
        <Field label="Client Secret">
          <Inp value={s.client_secret} onChange={(v) => set("client_secret", v)} type="password" placeholder="••••••••" />
        </Field>
      </div>

      <Field label="Redirect URI" hint="Must match the URI registered in your OAuth provider">
        <Inp value={s.redirect_uri} onChange={(v) => set("redirect_uri", v)} placeholder="/api/v1/auth/oauth2/callback" />
      </Field>

      <Field label="Scopes" hint="Space-separated list">
        <Inp value={s.scopes.join(" ")} onChange={(v) => set("scopes", v.split(/\s+/).filter(Boolean))} placeholder="openid profile email" />
      </Field>

      {s.driver === "custom" && (
        <>
          <hr className="border-border" />
          <p className="text-sm font-semibold text-foreground">Custom Endpoints</p>
          <Field label="Authorization URL">
            <Inp value={s.auth_url} onChange={(v) => set("auth_url", v)} placeholder="https://idp.example.com/oauth/authorize" />
          </Field>
          <Field label="Token URL">
            <Inp value={s.token_url} onChange={(v) => set("token_url", v)} placeholder="https://idp.example.com/oauth/token" />
          </Field>
          <Field label="User Info URL">
            <Inp value={s.userinfo_url} onChange={(v) => set("userinfo_url", v)} placeholder="https://idp.example.com/oauth/userinfo" />
          </Field>
        </>
      )}

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
