import { useState, useEffect } from "react";
import {
  Loader2,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Bell,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../hooks/useNotificationPreferences";
import type { NotificationPreferences } from "../types/notifications";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

const GRANULAR_LABELS: {
  key: keyof NotificationPreferences["notification_preferences"];
  labelKey: string;
  descriptionKey: string;
}[] = [
  {
    key: "analysis_completed",
    labelKey: "notifications.analysisCompleted",
    descriptionKey: "notifications.analysisCompletedDescription",
  },
  {
    key: "analysis_failed",
    labelKey: "notifications.analysisFailed",
    descriptionKey: "notifications.analysisFailedDescription",
  },
  {
    key: "cohort_generated",
    labelKey: "notifications.cohortGenerated",
    descriptionKey: "notifications.cohortGeneratedDescription",
  },
  {
    key: "study_completed",
    labelKey: "notifications.studyCompleted",
    descriptionKey: "notifications.studyCompletedDescription",
  },
  {
    key: "daily_digest",
    labelKey: "notifications.dailyDigest",
    descriptionKey: "notifications.dailyDigestDescription",
  },
];

export function NotificationSettings() {
  const { t } = useTranslation("settings");
  const { data, isLoading, error } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  const [form, setForm] = useState<NotificationPreferences>({
    notification_email: false,
    notification_sms: false,
    phone_number: null,
    notification_preferences: {
      analysis_completed: true,
      analysis_failed: true,
      cohort_generated: true,
      study_completed: true,
      daily_digest: true,
      daily_digest_mode: "always",
    },
  });

  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "success" | "error") => {
    const toastId = Date.now();
    setToasts((prev) => [...prev, { id: toastId, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  };

  useEffect(() => {
    if (!data) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setForm(data);
    });

    return () => {
      cancelled = true;
    };
  }, [data]);

  const handleToggle = (
    field: "notification_email" | "notification_sms",
  ) => {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleGranularToggle = (
    key: keyof NotificationPreferences["notification_preferences"],
  ) => {
    const current = form.notification_preferences[key];
    if (typeof current !== "boolean") return;
    setForm((prev) => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [key]: !current,
      },
    }));
  };

  const handlePhoneChange = (value: string) => {
    setForm((prev) => ({ ...prev, phone_number: value || null }));
  };

  const handleSave = () => {
    updateMutation.mutate(form, {
      onSuccess: () => {
        showToast(t("notifications.saved"), "success");
      },
      onError: () => {
        showToast(t("notifications.saveFailed"), "error");
      },
    });
  };

  const digestModes = [
    {
      value: "always",
      label: t("notifications.everyMorning"),
      desc: t("notifications.everyMorningDescription"),
    },
    {
      value: "alerts_only",
      label: t("notifications.alertsOnly"),
      desc: t("notifications.alertsOnlyDescription"),
    },
  ] as const;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={24} className="mx-auto text-critical mb-2" />
          <p className="text-critical">{t("notifications.loadFailed")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Email Notifications */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
            <Mail size={18} className="text-success" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("notifications.emailTitle")}
            </h3>
            <p className="text-xs text-text-muted">
              {t("notifications.emailSubtitle")}
            </p>
          </div>
          <ToggleSwitch
            checked={form.notification_email}
            onChange={() => handleToggle("notification_email")}
          />
        </div>

        {form.notification_email && (
          <div className="ml-12 space-y-3 border-l-2 border-border-default pl-4">
            {GRANULAR_LABELS.map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <ToggleSwitch
                  checked={
                    typeof form.notification_preferences[item.key] ===
                    "boolean"
                      ? (form.notification_preferences[item.key] as boolean)
                      : false
                  }
                  onChange={() => handleGranularToggle(item.key)}
                  size="sm"
                />
                <div>
                  <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                    {t(item.labelKey)}
                  </span>
                  <p className="text-xs text-text-ghost">{t(item.descriptionKey)}</p>
                </div>
              </label>
            ))}

            {/* Daily digest mode selector */}
            {form.notification_preferences.daily_digest && (
              <div className="mt-3 ml-1 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t("notifications.digestFrequency")}
                </p>
                {digestModes.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="daily_digest_mode"
                      value={opt.value}
                      checked={
                        form.notification_preferences.daily_digest_mode ===
                        opt.value
                      }
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          notification_preferences: {
                            ...prev.notification_preferences,
                            daily_digest_mode: opt.value,
                          },
                        }))
                      }
                      className="mt-0.5 accent-success"
                    />
                    <div>
                      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                        {opt.label}
                      </span>
                      <p className="text-xs text-text-ghost">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* SMS Notifications */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-domain-observation/10">
            <Smartphone size={18} className="text-domain-observation" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("notifications.smsTitle")}
            </h3>
            <p className="text-xs text-text-muted">
              {t("notifications.smsSubtitle")}
            </p>
          </div>
          <ToggleSwitch
            checked={form.notification_sms}
            onChange={() => handleToggle("notification_sms")}
          />
        </div>

        {form.notification_sms && (
          <div className="ml-12 space-y-4 border-l-2 border-border-default pl-4">
            {/* Phone number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t("notifications.phoneNumber")}
              </label>
              <input
                type="tel"
                value={form.phone_number ?? ""}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className={cn(
                  "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                  "text-text-primary placeholder:text-text-ghost",
                  "focus:border-domain-observation focus:outline-none focus:ring-1 focus:ring-domain-observation/40",
                )}
              />
            </div>

            {/* Granular toggles */}
            <div className="space-y-3">
              {GRANULAR_LABELS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  {(() => {
                    const checkedValue = form.notification_preferences[item.key];
                    return (
                      <ToggleSwitch
                        checked={typeof checkedValue === "boolean" ? checkedValue : false}
                        onChange={() => handleGranularToggle(item.key)}
                        size="sm"
                      />
                    );
                  })()}
                  <div>
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      {t(item.labelKey)}
                    </span>
                    <p className="text-xs text-text-ghost">{t(item.descriptionKey)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
            "bg-success text-surface-base hover:bg-success-dark disabled:opacity-50",
          )}
        >
          {updateMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Bell size={14} />
          )}
          {t("notifications.savePreferences")}
        </button>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-bottom-2",
              toast.type === "success"
                ? "border-success/30 bg-surface-raised text-success"
                : "border-critical/30 bg-surface-raised text-critical",
            )}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
  size = "md",
}: {
  checked: boolean;
  onChange: () => void;
  size?: "sm" | "md";
}) {
  const isSmall = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
        checked ? "bg-success" : "bg-surface-elevated",
        isSmall ? "h-5 w-9" : "h-6 w-11",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block transform rounded-full bg-white shadow transition duration-200 ease-in-out",
          isSmall
            ? checked
              ? "h-4 w-4 translate-x-4"
              : "h-4 w-4 translate-x-0"
            : checked
              ? "h-5 w-5 translate-x-5"
              : "h-5 w-5 translate-x-0",
        )}
      />
    </button>
  );
}
