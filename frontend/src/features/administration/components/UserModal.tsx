import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useCreateUser, useUpdateUser } from "../hooks/useAdminUsers";
import type { User, Role } from "@/types/models";

interface Props {
  user: User | null;
  roles: Role[];
  onClose: () => void;
}

export function UserModal({ user, roles, onClose }: Props) {
  const isEdit = user !== null;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    roles: user?.roles ?? [],
  });
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const toggleRole = (roleName: string) =>
    set("roles", form.roles.includes(roleName)
      ? form.roles.filter((r) => r !== roleName)
      : [...form.roles, roleName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      email: form.email,
      roles: form.roles,
      ...(form.password ? { password: form.password } : {}),
    };

    const opts = {
      onSuccess: onClose,
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? "An error occurred.";
        setError(msg);
      },
    };

    if (isEdit) {
      updateUser.mutate({ id: user.id, data: payload }, opts);
    } else {
      if (!form.password) { setError("Password is required."); return; }
      createUser.mutate(payload as Parameters<typeof createUser.mutate>[0], opts);
    }
  };

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit User" : "New User"}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Password {isEdit && <span className="normal-case font-normal">(leave blank to keep current)</span>}
            </span>
            <input
              type="password"
              required={!isEdit}
              placeholder={isEdit ? "••••••••" : "Min 8 chars, mixed case + number"}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Roles</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(r.name)}
                    onChange={() => toggleRole(r.name)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm text-foreground">{r.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
