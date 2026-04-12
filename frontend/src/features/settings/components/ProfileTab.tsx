import { useState, useEffect } from "react";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useUpdateProfile } from "../hooks/useProfile";
import { AvatarUpload } from "./AvatarUpload";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const updateMutation = useUpdateProfile();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    job_title: "",
    department: "",
    organization: "",
    bio: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        phone_number: user.phone_number ?? "",
        job_title: user.job_title ?? "",
        department: user.department ?? "",
        organization: user.organization ?? "",
        bio: user.bio ?? "",
      });
    }
  }, [user]);

  const showToast = (message: string, type: "success" | "error") => {
    const toastId = Date.now();
    setToasts((prev) => [...prev, { id: toastId, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        name: form.name,
        phone_number: form.phone_number || null,
        job_title: form.job_title || null,
        department: form.department || null,
        organization: form.organization || null,
        bio: form.bio || null,
      },
      {
        onSuccess: () => showToast("Profile saved successfully", "success"),
        onError: () => showToast("Failed to save profile", "error"),
      },
    );
  };

  const inputClass = cn(
    "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
    "text-text-primary placeholder:text-text-ghost",
    "focus:border-success focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
  );

  return (
    <div className="max-w-2xl space-y-8">
      {/* Avatar */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Profile Photo</h3>
        <AvatarUpload />
      </section>

      {/* Profile Details */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-6 space-y-5">
        <h3 className="text-sm font-semibold text-text-primary">Profile Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Name <span className="text-critical">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={inputClass}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Phone
            </label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={(e) => handleChange("phone_number", e.target.value)}
              className={inputClass}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Job Title
            </label>
            <input
              type="text"
              value={form.job_title}
              onChange={(e) => handleChange("job_title", e.target.value)}
              className={inputClass}
              placeholder="e.g. Research Scientist"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Department
            </label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => handleChange("department", e.target.value)}
              className={inputClass}
              placeholder="e.g. Clinical Informatics"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Organization
            </label>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => handleChange("organization", e.target.value)}
              className={inputClass}
              placeholder="e.g. Acumenus Data Sciences"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              rows={4}
              maxLength={2000}
              className={cn(inputClass, "resize-none")}
              placeholder="A brief description about yourself and your research interests..."
            />
            <p className="text-xs text-text-ghost text-right">
              {form.bio.length}/2000
            </p>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending || !form.name.trim()}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
            "bg-success text-surface-base hover:bg-success-dark disabled:opacity-50",
          )}
        >
          {updateMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Profile
        </button>
      </div>

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
