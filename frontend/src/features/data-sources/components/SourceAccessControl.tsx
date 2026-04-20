import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Shield, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateSource } from "../hooks/useSources";
import type { Source } from "@/types/models";

// Standard roles in Parthenon
const AVAILABLE_ROLES = [
  "admin",
  "researcher",
  "data-steward",
  "mapping-reviewer",
  "viewer",
];

interface SourceAccessControlProps {
  source: Source;
}

export function SourceAccessControl({ source }: SourceAccessControlProps) {
  const { t } = useTranslation("app");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    source.restricted_to_roles ?? [],
  );
  const [dirty, setDirty] = useState(false);
  const updateMutation = useUpdateSource();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSelectedRoles(source.restricted_to_roles ?? []);
    setDirty(false);
  }, [source.restricted_to_roles]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role];
      setDirty(true);
      return next;
    });
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: source.id,
        payload: {
          source_name: source.source_name,
          source_key: source.source_key,
          source_dialect: source.source_dialect,
          source_connection: source.source_connection,
          restricted_to_roles: selectedRoles.length > 0 ? selectedRoles : null,
        },
      },
      { onSuccess: () => setDirty(false) },
    );
  };

  const isRestricted = selectedRoles.length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-border-default bg-surface-raised p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-info" />
          <h4 className="text-xs font-semibold text-text-primary">
            {t("dataSources.common.accessControl")}
          </h4>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            isRestricted
              ? "bg-info/10 text-info"
              : "bg-success/10 text-success",
          )}
        >
          {isRestricted
            ? t("dataSources.accessControl.restricted")
            : t("dataSources.accessControl.unrestricted")}
        </span>
      </div>

      <p className="text-[11px] text-text-muted">
        {isRestricted
          ? t("dataSources.accessControl.restrictedHelp")
          : t("dataSources.accessControl.unrestrictedHelp")}
      </p>

      <div className="flex flex-wrap gap-2">
        {AVAILABLE_ROLES.map((role) => {
          const active = selectedRoles.includes(role);
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-info/40 bg-info/10 text-info"
                  : "border-border-default bg-surface-base text-text-muted hover:text-text-secondary",
              )}
            >
              {active ? <Check size={10} /> : <X size={10} className="opacity-30" />}
              {role}
            </button>
          );
        })}
      </div>

      {dirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-info px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-domain-observation disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Check size={12} />
          )}
          {t("dataSources.actions.saveAccessControl")}
        </button>
      )}
    </div>
  );
}
