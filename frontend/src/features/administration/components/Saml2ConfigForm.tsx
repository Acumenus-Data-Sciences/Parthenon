import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Saml2Settings } from "@/types/models";

interface Props {
  settings: Saml2Settings;
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

function Inp({ value, onChange, placeholder = "" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

const NAME_ID_FORMATS = [
  "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
  "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
];

export function Saml2ConfigForm({ settings, onSave, isPending, saveSuccess }: Props) {
  const [s, setS] = useState<Saml2Settings>({ ...settings });
  const set = <K extends keyof Saml2Settings>(k: K, v: Saml2Settings[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-foreground">Identity Provider (IdP)</p>
      <Field label="IdP Entity ID">
        <Inp value={s.idp_entity_id} onChange={(v) => set("idp_entity_id", v)} placeholder="https://idp.example.com/entity" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SSO URL" hint="Single Sign-On endpoint">
          <Inp value={s.idp_sso_url} onChange={(v) => set("idp_sso_url", v)} placeholder="https://idp.example.com/sso" />
        </Field>
        <Field label="SLO URL" hint="Single Logout endpoint (optional)">
          <Inp value={s.idp_slo_url} onChange={(v) => set("idp_slo_url", v)} placeholder="https://idp.example.com/slo" />
        </Field>
      </div>
      <Field label="IdP Certificate" hint="Paste the X.509 certificate (PEM format, with or without headers)">
        <textarea
          rows={6}
          value={s.idp_certificate}
          onChange={(e) => set("idp_certificate", e.target.value)}
          placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDxTCC...&#10;-----END CERTIFICATE-----"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </Field>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">Service Provider (SP)</p>
      <Field label="SP Entity ID" hint="Your Parthenon instance URL — must match what the IdP has registered">
        <Inp value={s.sp_entity_id} onChange={(v) => set("sp_entity_id", v)} placeholder="https://parthenon.example.com" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ACS URL" hint="Assertion Consumer Service">
          <Inp value={s.sp_acs_url} onChange={(v) => set("sp_acs_url", v)} placeholder="/api/v1/auth/saml2/callback" />
        </Field>
        <Field label="SLO URL">
          <Inp value={s.sp_slo_url} onChange={(v) => set("sp_slo_url", v)} placeholder="/api/v1/auth/saml2/logout" />
        </Field>
      </div>
      <Field label="NameID Format">
        <select
          value={s.name_id_format}
          onChange={(e) => set("name_id_format", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {NAME_ID_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={s.sign_assertions} onChange={(e) => set("sign_assertions", e.target.checked)} className="accent-primary" />
        Sign assertions (requires SP private key — configure in server env)
      </label>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">Attribute Mapping</p>
      <p className="text-xs text-muted-foreground">Map SAML assertion attribute names to Parthenon user fields.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email attribute">
          <Inp value={s.attribute_mapping.email} onChange={(v) => set("attribute_mapping", { ...s.attribute_mapping, email: v })} placeholder="email" />
        </Field>
        <Field label="Display name attribute">
          <Inp value={s.attribute_mapping.name} onChange={(v) => set("attribute_mapping", { ...s.attribute_mapping, name: v })} placeholder="displayName" />
        </Field>
      </div>

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
