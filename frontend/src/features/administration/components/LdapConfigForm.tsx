import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("app");
  const [s, setS] = useState<LdapSettings>({ ...settings });
  const set = <K extends keyof LdapSettings>(k: K, v: LdapSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-foreground">
        {t("administration.authProviders.ldapForm.sections.connection")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field
            label={t("administration.authProviders.ldapForm.labels.host")}
            hint={t("administration.authProviders.ldapForm.hints.host")}
          >
            <Input value={s.host} onChange={(v) => set("host", v)} placeholder="ldap.example.com" />
          </Field>
        </div>
        <Field label={t("administration.authProviders.ldapForm.labels.port")}>
          <Input value={s.port} onChange={(v) => set("port", parseInt(v) || 389)} type="number" placeholder="389" />
        </Field>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={s.use_ssl} onChange={(e) => set("use_ssl", e.target.checked)} className="accent-primary" />
          {t("administration.authProviders.ldapForm.labels.useSsl")}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={s.use_tls} onChange={(e) => set("use_tls", e.target.checked)} className="accent-primary" />
          {t("administration.authProviders.ldapForm.labels.useTls")}
        </label>
        <Field label={t("administration.authProviders.ldapForm.labels.timeout")}>
          <Input value={s.timeout} onChange={(v) => set("timeout", parseInt(v) || 5)} type="number" placeholder="5" />
        </Field>
      </div>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">
        {t("administration.authProviders.ldapForm.sections.bindCredentials")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("administration.authProviders.ldapForm.labels.bindDn")}
          hint={t("administration.authProviders.ldapForm.hints.bindDn")}
        >
          <Input
            value={s.bind_dn}
            onChange={(v) => set("bind_dn", v)}
            placeholder={t("administration.authProviders.ldapForm.placeholders.bindDn")}
          />
        </Field>
        <Field label={t("administration.authProviders.ldapForm.labels.bindPassword")}>
          <Input value={s.bind_password} onChange={(v) => set("bind_password", v)} type="password" placeholder="••••••••" />
        </Field>
      </div>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">
        {t("administration.authProviders.ldapForm.sections.userSearch")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("administration.authProviders.ldapForm.labels.baseDn")}>
          <Input
            value={s.base_dn}
            onChange={(v) => set("base_dn", v)}
            placeholder={t("administration.authProviders.ldapForm.placeholders.baseDn")}
          />
        </Field>
        <Field label={t("administration.authProviders.ldapForm.labels.userSearchBase")}>
          <Input
            value={s.user_search_base}
            onChange={(v) => set("user_search_base", v)}
            placeholder={t("administration.authProviders.ldapForm.placeholders.userSearchBase")}
          />
        </Field>
        <Field
          label={t("administration.authProviders.ldapForm.labels.userFilter")}
          hint={t("administration.authProviders.ldapForm.hints.userFilter")}
        >
          <Input
            value={s.user_filter}
            onChange={(v) => set("user_filter", v)}
            placeholder={t("administration.authProviders.ldapForm.placeholders.userFilter")}
          />
        </Field>
        <Field label={t("administration.authProviders.ldapForm.labels.timeout")}>
          <Input value={s.timeout} onChange={(v) => set("timeout", parseInt(v) || 5)} type="number" placeholder="5" />
        </Field>
      </div>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">
        {t("administration.authProviders.ldapForm.sections.attributeMapping")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("administration.authProviders.ldapForm.labels.usernameField")}>
          <Input value={s.username_field} onChange={(v) => set("username_field", v)} placeholder="uid" />
        </Field>
        <Field label={t("administration.authProviders.ldapForm.labels.emailField")}>
          <Input value={s.email_field} onChange={(v) => set("email_field", v)} placeholder="mail" />
        </Field>
        <Field label={t("administration.authProviders.ldapForm.labels.displayNameField")}>
          <Input value={s.name_field} onChange={(v) => set("name_field", v)} placeholder="cn" />
        </Field>
      </div>

      <hr className="border-border" />
      <p className="text-sm font-semibold text-foreground">
        {t("administration.authProviders.ldapForm.sections.groupSync")}
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={s.group_sync} onChange={(e) => set("group_sync", e.target.checked)} className="accent-primary" />
        {t("administration.authProviders.ldapForm.labels.syncGroups")}
      </label>
      {s.group_sync && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("administration.authProviders.ldapForm.labels.groupSearchBase")}>
            <Input
              value={s.group_search_base}
              onChange={(v) => set("group_search_base", v)}
              placeholder={t("administration.authProviders.ldapForm.placeholders.groupSearchBase")}
            />
          </Field>
          <Field label={t("administration.authProviders.ldapForm.labels.groupFilter")}>
            <Input
              value={s.group_filter}
              onChange={(v) => set("group_filter", v)}
              placeholder={t("administration.authProviders.ldapForm.placeholders.groupFilter")}
            />
          </Field>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => onSave(s as unknown as Record<string, unknown>)}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending
            ? t("administration.authProviders.ldapForm.actions.saving")
            : t("administration.authProviders.ldapForm.actions.save")}
        </button>
        {saveSuccess && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-4 w-4" />{" "}
            {t("administration.authProviders.ldapForm.actions.saved")}
          </span>
        )}
      </div>
    </div>
  );
}
