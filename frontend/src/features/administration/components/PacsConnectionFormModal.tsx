import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useTestPacsConnection } from "../hooks/usePacsConnections";
import { useCreatePacsConnection, useUpdatePacsConnection } from "../hooks/usePacsConnections";
import type { PacsConnection, PacsConnectionPayload, PacsTestResult } from "../api/pacsApi";
import type { Source } from "@/types/models";

interface PacsConnectionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editConnection: PacsConnection | null;
}

export default function PacsConnectionFormModal({
  isOpen,
  onClose,
  editConnection,
}: PacsConnectionFormModalProps) {
  const isEdit = editConnection != null;
  const createMut = useCreatePacsConnection();
  const updateMut = useUpdatePacsConnection();
  const testMut = useTestPacsConnection();

  const [sources, setSources] = useState<Source[]>([]);
  const [testResult, setTestResult] = useState<PacsTestResult | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState("orthanc");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState("none");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [sourceId, setSourceId] = useState<number | undefined>(undefined);
  const [isActive, setIsActive] = useState(true);

  // Reset form when opening / changing editConnection
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setTestResult(null);
    if (editConnection) {
      setName(editConnection.name);
      setType(editConnection.type);
      setBaseUrl(editConnection.base_url);
      setAuthType(editConnection.auth_type);
      setUsername("");
      setPassword("");
      setToken("");
      setSourceId(editConnection.source_id ?? undefined);
      setIsActive(editConnection.is_active);
    } else {
      setName("");
      setType("orthanc");
      setBaseUrl("");
      setAuthType("none");
      setUsername("");
      setPassword("");
      setToken("");
      setSourceId(undefined);
      setIsActive(true);
    }
  }, [isOpen, editConnection]);

  // Load sources for the dropdown
  useEffect(() => {
    if (!isOpen) return;
    fetchSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, [isOpen]);

  async function handleTest() {
    if (!editConnection) return;
    setTestResult(null);
    try {
      const result = await testMut.mutateAsync(editConnection.id);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: "Test request failed", latency_ms: null });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const credentials: Record<string, string> = {};
    if (authType === "basic") {
      credentials.username = username;
      credentials.password = password;
    } else if (authType === "bearer") {
      credentials.token = token;
    }

    const payload: PacsConnectionPayload = {
      name,
      type,
      base_url: baseUrl,
      auth_type: authType,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      is_active: isActive,
      source_id: sourceId ?? null,
    };

    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: editConnection.id, data: payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save connection";
      setError(msg);
    }
  }

  const pending = createMut.isPending || updateMut.isPending;

  if (!isOpen) return null;

  const inputCls =
    "w-full px-3 py-2 text-sm bg-surface-base border border-border-default rounded-lg text-text-primary placeholder-[#5A5650] focus:outline-none focus:border-success/50 focus:ring-1 focus:ring-[#2DD4BF]/30";
  const labelCls = "block text-xs font-medium text-text-muted mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border-default bg-surface-raised shadow-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {isEdit ? "Edit PACS Connection" : "Add PACS Connection"}
              </h2>
              <p className="text-xs text-text-ghost mt-0.5">
                Configure a DICOM imaging server connection.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-text-ghost hover:text-text-secondary hover:bg-surface-elevated transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className={labelCls}>Name</label>
              <input
                className={inputCls}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main PACS Server"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select
                  className={inputCls}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="orthanc">Orthanc</option>
                  <option value="dicomweb">DICOMweb</option>
                  <option value="google_healthcare">Google Healthcare</option>
                  <option value="cloud">Cloud</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Auth Type</label>
                <select
                  className={inputCls}
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="basic">Basic Auth</option>
                  <option value="bearer">Bearer Token</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Base URL</label>
              <input
                className={inputCls}
                required
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://pacs.hospital.org:8042"
              />
            </div>

            {/* Conditional credential fields */}
            {authType === "basic" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Username</label>
                  <input
                    className={inputCls}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEdit ? "Leave blank to keep existing" : "password"}
                  />
                </div>
              </div>
            )}

            {authType === "bearer" && (
              <div>
                <label className={labelCls}>Bearer Token</label>
                <input
                  className={inputCls}
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={isEdit ? "Leave blank to keep existing" : "token"}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Linked Source (optional)</label>
              <select
                className={inputCls}
                value={sourceId ?? ""}
                onChange={(e) =>
                  setSourceId(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">None</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.source_name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-[#2DD4BF]"
              />
              Active
            </label>

            {/* Test result */}
            {testResult && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                  testResult.success
                    ? "border-success/20 bg-success/5 text-success"
                    : "border-critical/20 bg-critical/5 text-critical",
                )}
              >
                {testResult.success ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <XCircle size={12} />
                )}
                <span>{testResult.message}</span>
                {testResult.latency_ms != null && (
                  <span className="font-['IBM_Plex_Mono',monospace]">
                    ({testResult.latency_ms}ms)
                  </span>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-critical/20 bg-critical/5 px-3 py-2 text-xs text-critical">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border-default flex justify-between">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testMut.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-sm text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors disabled:opacity-40"
                >
                  {testMut.isPending && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Test Connection
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? "Save Changes" : "Create Connection"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
