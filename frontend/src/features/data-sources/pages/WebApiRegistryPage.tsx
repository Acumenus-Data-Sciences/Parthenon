import { useState } from "react";
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWebApiRegistries,
  useCreateWebApiRegistry,
  useDeleteWebApiRegistry,
  useSyncWebApiRegistry,
} from "../hooks/useSources";
import type { WebApiImportResult } from "@/types/models";

export function WebApiRegistryPage() {
  const { data: registries, isLoading } = useWebApiRegistries();
  const createMutation = useCreateWebApiRegistry();
  const deleteMutation = useDeleteWebApiRegistry();
  const syncMutation = useSyncWebApiRegistry();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "basic" | "bearer">("none");
  const [authCredentials, setAuthCredentials] = useState("");
  const [syncResult, setSyncResult] = useState<{ id: number; result: WebApiImportResult } | null>(null);

  const handleCreate = () => {
    if (!name.trim() || !baseUrl.trim()) return;
    createMutation.mutate(
      {
        name: name.trim(),
        base_url: baseUrl.trim(),
        auth_type: authType,
        auth_credentials: authCredentials || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setName("");
          setBaseUrl("");
          setAuthType("none");
          setAuthCredentials("");
        },
      },
    );
  };

  const handleSync = (id: number) => {
    setSyncResult(null);
    syncMutation.mutate(id, {
      onSuccess: (data) => setSyncResult({ id, result: data }),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Legacy WebAPI Registry
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Manage connections to legacy OHDSI WebAPI instances for source
            migration and compatibility.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A227] px-3 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#D4AF37] transition-colors"
        >
          <Plus size={14} />
          Add Registry
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-[#C9A227]/30 bg-[#151518] p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#8A857D] mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production WebAPI"
                className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#C9A227] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A857D] mb-1">Base URL</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://webapi.example.com/WebAPI"
                className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#C9A227] focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#8A857D] mb-1">Auth Type</label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as "none" | "basic" | "bearer")}
                className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none"
              >
                <option value="none">None</option>
                <option value="basic">Basic Auth</option>
                <option value="bearer">Bearer Token</option>
              </select>
            </div>
            {authType !== "none" && (
              <div>
                <label className="block text-xs font-medium text-[#8A857D] mb-1">
                  {authType === "basic" ? "Credentials (user:pass)" : "Token"}
                </label>
                <input
                  type="password"
                  value={authCredentials}
                  onChange={(e) => setAuthCredentials(e.target.value)}
                  className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim() || !baseUrl.trim() || createMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A227] px-3 py-1.5 text-xs font-medium text-[#0E0E11] hover:bg-[#D4AF37] disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#8A857D] hover:text-[#C5C0B8]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Registry list */}
      {registries && registries.length > 0 ? (
        <div className="space-y-3">
          {registries.map((reg) => (
            <div
              key={reg.id}
              className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-[#818CF8]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#F0EDE8]">{reg.name}</h3>
                    <p className="text-xs font-mono text-[#8A857D]">{reg.base_url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      reg.is_active
                        ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                        : "bg-[#8A857D]/10 text-[#8A857D]",
                    )}
                  >
                    {reg.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-[#8A857D]">
                <span>Auth: {reg.auth_type}</span>
                {reg.last_synced_at && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    Last synced: {new Date(reg.last_synced_at).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSync(reg.id)}
                  disabled={syncMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-xs font-medium text-[#C5C0B8] hover:text-[#F0EDE8] transition-colors disabled:opacity-50"
                >
                  {syncMutation.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Sync Sources
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete registry "${reg.name}"?`)) {
                      deleteMutation.mutate(reg.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E85A6B]/20 px-3 py-1.5 text-xs font-medium text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>

              {/* Sync results */}
              {syncResult?.id === reg.id && (
                <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3 space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-[#2DD4BF]">
                      <CheckCircle size={12} />
                      {syncResult.result.imported} imported
                    </span>
                    {syncResult.result.skipped > 0 && (
                      <span className="flex items-center gap-1 text-[#C9A227]">
                        <XCircle size={12} />
                        {syncResult.result.skipped} skipped
                      </span>
                    )}
                  </div>
                  {syncResult.result.sources.length > 0 && (
                    <div className="text-[11px] text-[#8A857D] space-y-0.5">
                      {syncResult.result.sources.map((s, i) => (
                        <div key={i}>
                          <span className="font-mono">{s.source_key}</span> — {s.status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-12">
          <Globe size={24} className="text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D]">No WebAPI registries configured</p>
          <p className="mt-1 text-xs text-[#5A5650]">
            Add a legacy WebAPI instance to import data sources.
          </p>
        </div>
      )}
    </div>
  );
}
