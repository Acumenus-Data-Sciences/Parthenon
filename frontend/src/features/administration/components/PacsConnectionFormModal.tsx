import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("app");
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

  // Reset form when opening / changing editConnection — external-source sync
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
      setTestResult({
        success: false,
        message: t("administration.pacsConnectionModal.errors.testRequestFailed"),
        latency_ms: null,
      });
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
      const msg = err instanceof Error
        ? err.message
        : t("administration.pacsConnectionModal.errors.saveFailed");
      setError(msg);
    }
  }

  const pending = createMut.isPending || updateMut.isPending;

  if (!isOpen) return null;

  const inputCls =
    "w-full px-3 py-2 text-sm bg-surface-base border border-border-default rounded-lg text-text-primary placeholder-text-ghost focus:outline-none focus:border-success/50 focus:ring-1 focus:ring-success/30";
  const labelCls = "block text-xs font-medium text-text-muted mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border-default bg-surface-raised shadow-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {isEdit
                  ? t("administration.pacsConnectionModal.title.edit")
                  : t("administration.pacsConnectionModal.title.add")}
              </h2>
              <p className="text-xs text-text-ghost mt-0.5">
                {t("administration.pacsConnectionModal.description")}
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
              <label className={labelCls}>
                {t("administration.pacsConnectionModal.fields.name")}
              </label>
              <input
                className={inputCls}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("administration.pacsConnectionModal.placeholders.name")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {t("administration.pacsConnectionModal.fields.type")}
                </label>
                <select
                  className={inputCls}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="orthanc">{t("administration.pacsConnectionModal.types.orthanc")}</option>
                  <option value="dicomweb">{t("administration.pacsConnectionModal.types.dicomweb")}</option>
                  <option value="google_healthcare">{t("administration.pacsConnectionModal.types.googleHealthcare")}</option>
                  <option value="cloud">{t("administration.pacsConnectionModal.types.cloud")}</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  {t("administration.pacsConnectionModal.fields.authType")}
                </label>
                <select
                  className={inputCls}
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value)}
                >
                  <option value="none">{t("administration.pacsConnectionModal.auth.none")}</option>
                  <option value="basic">{t("administration.pacsConnectionModal.auth.basic")}</option>
                  <option value="bearer">{t("administration.pacsConnectionModal.auth.bearer")}</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                {t("administration.pacsConnectionModal.fields.baseUrl")}
              </label>
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
                  <label className={labelCls}>
                    {t("administration.pacsConnectionModal.fields.username")}
                  </label>
                  <input
                    className={inputCls}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t("administration.pacsConnectionModal.fields.password")}
                  </label>
                  <input
                    className={inputCls}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEdit
                      ? t("administration.pacsConnectionModal.placeholders.keepExisting")
                      : t("administration.pacsConnectionModal.placeholders.password")}
                  />
                </div>
              </div>
            )}

            {authType === "bearer" && (
              <div>
                <label className={labelCls}>
                  {t("administration.pacsConnectionModal.fields.bearerToken")}
                </label>
                <input
                  className={inputCls}
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={isEdit
                    ? t("administration.pacsConnectionModal.placeholders.keepExisting")
                    : t("administration.pacsConnectionModal.placeholders.token")}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>
                {t("administration.pacsConnectionModal.fields.linkedSource")}
              </label>
              <select
                className={inputCls}
                value={sourceId ?? ""}
                onChange={(e) =>
                  setSourceId(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">{t("administration.pacsConnectionModal.auth.none")}</option>
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
                className="accent-success"
              />
              {t("administration.pacsConnectionModal.fields.active")}
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
                    {t("administration.pacsConnectionModal.values.latency", {
                      ms: testResult.latency_ms,
                    })}
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
                  {t("administration.pacsConnectionModal.actions.testConnection")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                {t("administration.pacsConnectionModal.actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {isEdit
                  ? t("administration.pacsConnectionModal.actions.saveChanges")
                  : t("administration.pacsConnectionModal.actions.createConnection")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
