import { useState } from "react";
import { Modal, Button } from "@/components/ui";
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

  // Normalize roles to string[] defensively (handles both string[] and object[])
  const initialRoles = (user?.roles ?? []).map((r) =>
    typeof r === "string" ? r : (r as { name: string }).name,
  );

  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    roles: initialRoles,
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
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit User" : "New User"}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={isPending}
            onClick={() => {
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              handleSubmit(fakeEvent);
            }}
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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
      </form>
    </Modal>
  );
}
