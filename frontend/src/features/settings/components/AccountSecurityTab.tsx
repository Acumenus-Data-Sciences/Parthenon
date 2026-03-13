import { useState } from "react";
import { Loader2, Lock, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/api-client";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export function AccountSecurityTab() {
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
      showToast("Password changed successfully", "success");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to change password";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = cn(
    "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
    "text-[#F0EDE8] placeholder:text-[#5A5650]",
    "focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
  );

  return (
    <div className="max-w-2xl space-y-8">
      {/* Email (read-only) */}
      <section className="rounded-lg border border-[#232328] bg-[#151518] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#2DD4BF]/10">
            <Mail size={18} className="text-[#2DD4BF]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F0EDE8]">Email Address</h3>
            <p className="text-xs text-[#8A857D]">Your login email cannot be changed here</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className={cn(inputClass, "opacity-60 cursor-not-allowed")}
          />
          <p className="text-xs text-[#5A5650]">Contact your administrator to change your email address.</p>
        </div>
      </section>

      {/* Change Password */}
      <section className="rounded-lg border border-[#232328] bg-[#151518] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#C9A227]/10">
            <Lock size={18} className="text-[#C9A227]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F0EDE8]">Change Password</h3>
            <p className="text-xs text-[#8A857D]">Update your password regularly for security</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Current Password
            </label>
            <input
              type="password"
              value={form.current_password}
              onChange={(e) => setForm((prev) => ({ ...prev, current_password: e.target.value }))}
              className={inputClass}
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              New Password
            </label>
            <input
              type="password"
              value={form.new_password}
              onChange={(e) => setForm((prev) => ({ ...prev, new_password: e.target.value }))}
              className={inputClass}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Confirm New Password
            </label>
            <input
              type="password"
              value={form.new_password_confirmation}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, new_password_confirmation: e.target.value }))
              }
              className={inputClass}
              placeholder="Re-enter new password"
            />
            {form.new_password_confirmation && !passwordsMatch && (
              <p className="text-xs text-[#E85A6B]">Passwords do not match</p>
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
              "bg-[#C9A227] text-[#0E0E11] hover:bg-[#B8911F] disabled:opacity-50",
            )}
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Change Password
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
                ? "border-[#2DD4BF]/30 bg-[#151518] text-[#2DD4BF]"
                : "border-[#E85A6B]/30 bg-[#151518] text-[#E85A6B]",
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
