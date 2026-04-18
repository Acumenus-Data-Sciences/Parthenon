import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Lock, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/models";
import { cn } from "@/lib/utils";

interface Props {
  onPasswordChanged: () => void;
}

interface ChangePasswordResponse {
  message: string;
  user: User;
}

function StrengthBar({ password }: { password: string }) {
  const { t } = useTranslation("auth");
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = [
    "",
    t("setup.changePassword.strength.weak"),
    t("setup.changePassword.strength.fair"),
    t("setup.changePassword.strength.good"),
    t("setup.changePassword.strength.strong"),
    t("setup.changePassword.strength.excellent"),
  ];
  const colors = [
    "",
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-emerald-500",
    "bg-emerald-400",
  ];

  if (!password) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i <= score ? colors[score] : "bg-surface-elevated",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-text-muted">
        {labels[score] || t("setup.changePassword.strength.tooShort")}
      </p>
    </div>
  );
}

export function ChangePasswordStep({ onPasswordChanged }: Props) {
  const { t } = useTranslation("auth");
  const updateUser = useAuthStore((s) => s.updateUser);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (newPw !== confirmPw) {
      setError(t("setup.changePassword.errors.mismatch"));
      return;
    }
    if (newPw.length < 8) {
      setError(t("setup.changePassword.errors.tooShort"));
      return;
    }
    if (newPw === currentPw) {
      setError(t("setup.changePassword.errors.same"));
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post<ChangePasswordResponse>("/auth/change-password", {
        current_password: currentPw,
        new_password: newPw,
        new_password_confirmation: confirmPw,
      });
      updateUser(data.user);
      setDone(true);
      onPasswordChanged();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("setup.changePassword.errors.failed");
      setError(msg);
      setCurrentPw("");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-text-primary">
            {t("setup.changePassword.successTitle")}
          </h3>
          <p className="mt-1 text-base text-text-muted">
            {t("setup.changePassword.successDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">
          {t("setup.changePassword.title")}
        </h3>
        <p className="text-base text-text-muted">
          {t("setup.changePassword.intro")}
        </p>
      </div>

      {/* Installer credentials callout */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
        <div className="text-base">
          <p className="font-medium text-amber-300">
            {t("setup.changePassword.temporaryTitle")}
          </p>
          <p className="mt-0.5 text-sm text-amber-400/80">
            {t("setup.changePassword.temporaryPrefix")}{" "}
            <code className="rounded bg-amber-500/15 px-1 font-mono">
              {t("setup.changePassword.credentialsFile")}
            </code>{" "}
            {t("setup.changePassword.temporarySuffix")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Current password */}
        <div>
          <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-text-muted">
            {t("setup.changePassword.currentLabel")}
          </label>
          <div className="relative">
            <Lock
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              autoFocus
              placeholder={t("setup.changePassword.currentPlaceholder")}
              className="w-full rounded-md border border-border-default bg-surface-base py-2 pl-9 pr-3 text-base text-text-primary placeholder:text-text-ghost focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-text-muted">
            {t("setup.changePassword.newLabel")}
          </label>
          <div className="relative">
            <Lock
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
            <input
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              placeholder={t("setup.changePassword.newPlaceholder")}
              className="w-full rounded-md border border-border-default bg-surface-base py-2 pl-9 pr-10 text-base text-text-primary placeholder:text-text-ghost focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-muted"
              onClick={() => setShowNew((v) => !v)}
              aria-label={t("setup.changePassword.toggleNewVisibility")}
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <StrengthBar password={newPw} />
        </div>

        {/* Confirm */}
        <div>
          <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-text-muted">
            {t("setup.changePassword.confirmLabel")}
          </label>
          <div className="relative">
            <Lock
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              placeholder={t("setup.changePassword.confirmPlaceholder")}
              className={cn(
                "w-full rounded-md border bg-surface-base py-2 pl-9 pr-3 text-base text-text-primary placeholder:text-text-ghost focus:outline-none focus:ring-2 focus:ring-accent/50",
                confirmPw && newPw !== confirmPw
                  ? "border-red-500/50"
                  : "border-border-default",
              )}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface-base transition-colors hover:bg-accent-light disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Lock size={14} />
          )}
          {t("setup.changePassword.submit")}
        </button>
      </form>
    </div>
  );
}
