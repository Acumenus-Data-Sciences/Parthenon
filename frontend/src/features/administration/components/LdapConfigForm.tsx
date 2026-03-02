import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { LdapSettings } from "@/types/models";

interface Props {
  settings: LdapSettings;
  onSave: (s: Record<string, unknown>) => void;
  isPending: boolean;
  saveSuccess: boolean;
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground/70">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder = "" }: {
  value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
    />
  );
}

export function LdapConfigForm({ settings, onSave, isPending, saveSuccess }: Props) {
  const [s, setS] = useState<LdapSettings>({ ...settings });
  const set = <K extends keyof LdapSettings>(k: K, v: LdapSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-foreground">Connection</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Host" hint="LDAP server hostname or IP">
            <Input value={s.host} onChange={(v) => set("host", v)} placeholder="ldap.example.com" />
          </Field>
        </div>
        <Field label="Port">
          <Input value={s.port} onChange={(v) => set("port", parseInt(v) || 389)} type="number" placeholder="389" />
        </Field>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={s.use_ssl} onChange={(e) => set("use_ssl", e.target.checked)} className="accent-primary" />
          Use SSL (LDAPS)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={s.use_tls} onChange={(e) => set("use_tls", e.target.checked)} className="accent-primary" />
          Use StartTLS
        </label>
        <Field label="Timeout (s)">
          <Input value={s.timeout} onChange={(v) => set("timeout", parseInt(v) || 5)} type="number" placeholder="5" />
        </Field>
      </div>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">Bind Credentials</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bind DN" hint="Service account DN used for directory queries">
          <Input value={s.bind_dn} onChange={(v) => set("bind_dn", v)} placeholder="cn=svc-parthenon,dc=example,dc=com" />
        </Field>
        <Field label="Bind Password">
          <Input value={s.bind_password} onChange={(v) => set("bind_password", v)} type="password" placeholder="••••••••" />
        </Field>
      </div>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">User Search</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Base DN">
          <Input value={s.base_dn} onChange={(v) => set("base_dn", v)} placeholder="dc=example,dc=com" />
        </Field>
        <Field label="User Search Base">
          <Input value={s.user_search_base} onChange={(v) => set("user_search_base", v)} placeholder="ou=users,dc=example,dc=com" />
        </Field>
        <Field label="User Filter" hint="{username} is replaced at login time">
          <Input value={s.user_filter} onChange={(v) => set("user_filter", v)} placeholder="(uid={username})" />
        </Field>
        <Field label="Timeout (s)">
          <Input value={s.timeout} onChange={(v) => set("timeout", parseInt(v) || 5)} type="number" placeholder="5" />
        </Field>
      </div>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">Attribute Mapping</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Username field">
          <Input value={s.username_field} onChange={(v) => set("username_field", v)} placeholder="uid" />
        </Field>
        <Field label="Email field">
          <Input value={s.email_field} onChange={(v) => set("email_field", v)} placeholder="mail" />
        </Field>
        <Field label="Display name field">
          <Input value={s.name_field} onChange={(v) => set("name_field", v)} placeholder="cn" />
        </Field>
      </div>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">Group Sync</p>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={s.group_sync} onChange={(e) => set("group_sync", e.target.checked)} className="accent-primary" />
        Sync LDAP groups to Parthenon roles
      </label>
      {s.group_sync && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Group Search Base">
            <Input value={s.group_search_base} onChange={(v) => set("group_search_base", v)} placeholder="ou=groups,dc=example,dc=com" />
          </Field>
          <Field label="Group Filter">
            <Input value={s.group_filter} onChange={(v) => set("group_filter", v)} placeholder="(objectClass=groupOfNames)" />
          </Field>
        </div>
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
