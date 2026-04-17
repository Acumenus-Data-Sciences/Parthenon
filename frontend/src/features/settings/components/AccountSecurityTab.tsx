import { useState } from "react";
import { Loader2, Lock, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/api-client";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export function AccountSecurityTab() {
  const { t } = useTranslation("settings");
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    new_password_confirmation: "",
  });

  const showToast = (message: string, type: "success" | "error") => {
    const toastId = Date.now();
    setToasts((prev) => [...prev, { id: toastId, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  };

  const passwordsMatch =
    form.new_password === form.new_password_confirmation;

  const canSubmit =
    form.current_password.length > 0 &&
    form.new_password.length >= 8 &&
    passwordsMatch &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const { data } = await apiClient.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
        new_password_confirmation: form.new_password_confirmation,
      });
      if (data.user) updateUser(data.user);
      setForm({ current_password: "", new_password: "", new_password_confirmation: "" });
      showToast(t("account.passwordChanged"), "success");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("account.passwordChangeFailed");
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = cn(
    "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
    "text-text-primary placeholder:text-text-ghost",
    "focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40",
  );

  return (
    <div className="max-w-2xl space-y-8">
      {/* Email (read-only) */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
            <Mail size={18} className="text-success" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {t("account.emailTitle")}
            </h3>
            <p className="text-xs text-text-muted">{t("account.emailSubtitle")}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className={cn(inputClass, "opacity-60 cursor-not-allowed")}
          />
          <p className="text-xs text-text-ghost">{t("account.emailHelp")}</p>
        </div>
      </section>

      {/* Change Password */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10">
            <Lock size={18} className="text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {t("account.passwordTitle")}
            </h3>
            <p className="text-xs text-text-muted">{t("account.passwordSubtitle")}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t("account.currentPassword")}
            </label>
            <input
              type="password"
              value={form.current_password}
              onChange={(e) => setForm((prev) => ({ ...prev, current_password: e.target.value }))}
              className={inputClass}
              placeholder={t("account.currentPasswordPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t("account.newPassword")}
            </label>
            <input
              type="password"
              value={form.new_password}
              onChange={(e) => setForm((prev) => ({ ...prev, new_password: e.target.value }))}
              className={inputClass}
              placeholder={t("account.newPasswordPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t("account.confirmPassword")}
            </label>
            <input
              type="password"
              value={form.new_password_confirmation}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, new_password_confirmation: e.target.value }))
              }
              className={inputClass}
              placeholder={t("account.confirmPasswordPlaceholder")}
            />
            {form.new_password_confirmation && !passwordsMatch && (
              <p className="text-xs text-critical">{t("account.passwordsDoNotMatch")}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
              "bg-accent text-surface-base hover:bg-accent-dark disabled:opacity-50",
            )}
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            {t("account.changePassword")}
          </button>
        </div>
      </section>

      {/* Toasts */}
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
            {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
