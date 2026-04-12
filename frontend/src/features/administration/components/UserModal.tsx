import { useState } from "react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#232328] bg-[#1C1C20] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232328] px-6 py-4">
          <h2 className="text-base font-semibold text-[#F0EDE8]">
            {isEdit ? "Edit User" : "New User"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5A5650] transition-colors hover:bg-[#2A2A30] hover:text-[#8A857D]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2 text-sm text-[#E85A6B]">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                Full Name
              </span>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
              />
            </label>

            {/* Email */}
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                Email
              </span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] font-['IBM_Plex_Mono',monospace] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
              />
            </label>
          </div>

          {/* Password */}
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
              Password{" "}
              {isEdit && (
                <span className="normal-case font-normal text-[#3A3A42]">
                  (leave blank to keep current)
                </span>
              )}
            </span>
            <input
              type="password"
              required={!isEdit}
              placeholder={isEdit ? "••••••••" : "Min 8 chars, mixed case + number"}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
            />
          </label>

          {/* Roles */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
              Roles
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {roles.map((r) => {
                const checked = form.roles.includes(r.name);
                return (
                  <label
                    key={r.id}
                    className={[
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                      checked
                        ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/5"
                        : "border-[#232328] bg-[#151518] hover:border-[#2A2A30]",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(r.name)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-[#3A3A42] accent-[#2DD4BF]"
                    />
                    <span
                      className="text-xs font-medium"
                      style={{ color: checked ? "#2DD4BF" : "#8A857D" }}
                    >
                      {r.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[#232328] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2 text-sm text-[#8A857D] transition-colors hover:border-[#3A3A42] hover:text-[#C5C0B8]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              handleSubmit(fakeEvent);
            }}
            className="rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-semibold text-[#0E0E11] transition-colors hover:bg-[#25B8A5] disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}
