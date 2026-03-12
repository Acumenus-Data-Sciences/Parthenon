import { useState, useEffect } from "react";
import {
  Loader2,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Bell,
} from "lucide-react";
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
  label: string;
  description: string;
}[] = [
  {
    key: "analysis_completed",
    label: "Analysis Completed",
    description: "Receive a notification when an analysis finishes successfully",
  },
  {
    key: "analysis_failed",
    label: "Analysis Failed",
    description: "Receive a notification when an analysis encounters an error",
  },
  {
    key: "cohort_generated",
    label: "Cohort Generated",
    description: "Receive a notification when a cohort generation completes",
  },
  {
    key: "study_completed",
    label: "Study Completed",
    description: "Receive a notification when a study run finishes",
  },
  {
    key: "daily_digest",
    label: "Daily Ops Digest",
    description:
      "Receive a daily morning email with CI status, service health, data quality, and changelog",
  },
];

export function NotificationSettings() {
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
    if (data) {
      setForm(data);
    }
  }, [data]);

  const handleToggle = (
    field: "notification_email" | "notification_sms",
  ) => {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleGranularToggle = (
    key: keyof NotificationPreferences["notification_preferences"],
  ) => {
    setForm((prev) => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [key]: !prev.notification_preferences[key],
      },
    }));
  };

  const handlePhoneChange = (value: string) => {
    setForm((prev) => ({ ...prev, phone_number: value || null }));
  };

  const handleSave = () => {
    updateMutation.mutate(form, {
      onSuccess: () => {
        showToast("Notification preferences saved successfully", "success");
      },
      onError: () => {
        showToast("Failed to save notification preferences", "error");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={24} className="mx-auto text-[#E85A6B] mb-2" />
          <p className="text-[#E85A6B]">Failed to load notification preferences</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Email Notifications */}
      <section className="rounded-lg border border-[#232328] bg-[#151518] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#2DD4BF]/10">
            <Mail size={18} className="text-[#2DD4BF]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Email Notifications
            </h3>
            <p className="text-xs text-[#8A857D]">
              Receive notifications via email
            </p>
          </div>
          <ToggleSwitch
            checked={form.notification_email}
            onChange={() => handleToggle("notification_email")}
          />
        </div>

        {form.notification_email && (
          <div className="ml-12 space-y-3 border-l-2 border-[#232328] pl-4">
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
                  <span className="text-sm text-[#C5C0B8] group-hover:text-[#F0EDE8] transition-colors">
                    {item.label}
                  </span>
                  <p className="text-xs text-[#5A5650]">{item.description}</p>
                </div>
              </label>
            ))}

            {/* Daily digest mode selector */}
            {form.notification_preferences.daily_digest && (
              <div className="mt-3 ml-1 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
                  Digest Frequency
                </p>
                {(
                  [
                    {
                      value: "always",
                      label: "Every morning",
                      desc: "Full summary at 9am daily",
                    },
                    {
                      value: "alerts_only",
                      label: "Alerts only",
                      desc: "Only when something needs attention",
                    },
                  ] as const
                ).map((opt) => (
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
                      className="mt-0.5 accent-[#2DD4BF]"
                    />
                    <div>
                      <span className="text-sm text-[#C5C0B8] group-hover:text-[#F0EDE8] transition-colors">
                        {opt.label}
                      </span>
                      <p className="text-xs text-[#5A5650]">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* SMS Notifications */}
      <section className="rounded-lg border border-[#232328] bg-[#151518] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#A78BFA]/10">
            <Smartphone size={18} className="text-[#A78BFA]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              SMS Notifications
            </h3>
            <p className="text-xs text-[#8A857D]">
              Receive notifications via text message
            </p>
          </div>
          <ToggleSwitch
            checked={form.notification_sms}
            onChange={() => handleToggle("notification_sms")}
          />
        </div>

        {form.notification_sms && (
          <div className="ml-12 space-y-4 border-l-2 border-[#232328] pl-4">
            {/* Phone number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone_number ?? ""}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className={cn(
                  "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] placeholder:text-[#5A5650]",
                  "focus:border-[#A78BFA] focus:outline-none focus:ring-1 focus:ring-[#A78BFA]/40",
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
                  <ToggleSwitch
                    checked={form.notification_preferences[item.key]}
                    onChange={() => handleGranularToggle(item.key)}
                    size="sm"
                  />
                  <div>
                    <span className="text-sm text-[#C5C0B8] group-hover:text-[#F0EDE8] transition-colors">
                      {item.label}
                    </span>
                    <p className="text-xs text-[#5A5650]">{item.description}</p>
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
            "bg-[#2DD4BF] text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50",
          )}
        >
          {updateMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Bell size={14} />
          )}
          Save Preferences
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
                ? "border-[#2DD4BF]/30 bg-[#151518] text-[#2DD4BF]"
                : "border-[#E85A6B]/30 bg-[#151518] text-[#E85A6B]",
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
        checked ? "bg-[#2DD4BF]" : "bg-[#232328]",
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
