import { useState, useEffect } from "react";
import { Bot, Loader2, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import {
  useAiProviders,
  useUpdateAiProvider,
  useTestAiProvider,
  useActivateAiProvider,
  useToggleAiProvider,
} from "@/features/administration/hooks/useAiProviders";
import { cn } from "@/lib/utils";
import type { AiProviderSetting } from "@/types/models";

interface Props {
  onConfigured: () => void;
}

interface ProviderMeta {
  region: string;
  regionColor: string;
  models: string[];
  hasApiKey: boolean;
  hasBaseUrl: boolean;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  ollama: {
    region: "Local",
    regionColor: "bg-gray-500/10 text-gray-400",
    models: ["MedAIBase/MedGemma1.5:4b", "llama3.2", "gemma3:4b", "mistral"],
    hasApiKey: false,
    hasBaseUrl: true,
  },
  anthropic: {
    region: "US",
    regionColor: "bg-blue-500/10 text-blue-400",
    models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
  openai: {
    region: "US",
    regionColor: "bg-blue-500/10 text-blue-400",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
  gemini: {
    region: "US",
    regionColor: "bg-blue-500/10 text-blue-400",
    models: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
  deepseek: {
    region: "China",
    regionColor: "bg-red-500/10 text-red-400",
    models: ["deepseek-chat", "deepseek-reasoner"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
  qwen: {
    region: "China",
    regionColor: "bg-red-500/10 text-red-400",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
  moonshot: {
    region: "China",
    regionColor: "bg-red-500/10 text-red-400",
    models: ["moonshot-v1-128k"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
  mistral: {
    region: "EU",
    regionColor: "bg-emerald-500/10 text-emerald-400",
    models: ["mistral-large-latest", "mistral-medium"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
};

interface TestResult {
  success: boolean;
  message: string;
}

function OtherProviderRow({
  provider,
  onActivate,
  isActivating,
}: {
  provider: AiProviderSetting;
  onActivate: () => void;
  isActivating: boolean;
}) {
  const meta = PROVIDER_META[provider.provider_type];
  if (!meta) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface-overlay px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-elevated">
          <Bot size={14} className="text-text-muted" />
        </div>
        <div>
          <span className="text-sm font-medium text-text-primary">{provider.display_name}</span>
          <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[9px] font-medium", meta.regionColor)}>
            {meta.region}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onActivate}
        disabled={isActivating}
        className="rounded-md border border-surface-highlight px-3 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
      >
        Switch to this
      </button>
    </div>
  );
}

export function AiProviderStep({ onConfigured }: Props) {
  const { data: providers, isLoading } = useAiProviders();
  const updateMutation = useUpdateAiProvider();
  const testMutation = useTestAiProvider();
  const activateMutation = useActivateAiProvider();
  const toggleMutation = useToggleAiProvider();

  const activeProvider = providers?.find((p) => p.is_active);
  const otherProviders = providers?.filter((p) => !p.is_active) ?? [];
  const meta = activeProvider ? PROVIDER_META[activeProvider.provider_type] : null;

  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showOthers, setShowOthers] = useState(false);

  // Prepopulate from active provider
  useEffect(() => {
    if (activeProvider) {
      setModel(activeProvider.model || "");
      setBaseUrl(
        typeof activeProvider.settings?.base_url === "string"
          ? activeProvider.settings.base_url
          : "http://host.docker.internal:11434",
      );
      setApiKey(
        typeof activeProvider.settings?.api_key === "string"
          ? activeProvider.settings.api_key
          : "",
      );
      setDirty(false);
      setTestResult(null);
    }
  }, [activeProvider]);

  function handleSave() {
    if (!activeProvider || !meta) return;
    const settings: Record<string, string> = {};
    if (meta.hasApiKey) settings.api_key = apiKey;
    if (meta.hasBaseUrl) settings.base_url = baseUrl;

    updateMutation.mutate(
      { type: activeProvider.provider_type, data: { model, settings } },
      {
        onSuccess: () => {
          setDirty(false);
          onConfigured();
        },
      },
    );
  }

  function handleTest() {
    if (!activeProvider) return;
    setTestResult(null);
    testMutation.mutate(activeProvider.provider_type, {
      onSuccess: (r) => {
        setTestResult(r);
        if (r.success) onConfigured();
      },
      onError: () => setTestResult({ success: false, message: "Connection test failed." }),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="ml-2 text-sm text-text-muted">Loading AI providers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">AI Provider Configuration</h3>
        <p className="text-sm text-text-muted">
          Configure which AI backend powers Abby, the research assistant. Only one provider
          is active at a time.
        </p>
      </div>

      {/* Active provider banner */}
      {activeProvider && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-emerald-400">
            Active provider:{" "}
            <span className="font-semibold">{activeProvider.display_name}</span>
            {activeProvider.model && (
              <span className="ml-2 font-normal text-emerald-300/80">
                / {activeProvider.model}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Active provider config */}
      {activeProvider && meta && (
        <div className="rounded-lg border border-border-default bg-surface-overlay p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Model selector */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Model
              </label>
              {meta.models.length > 0 ? (
                <select
                  className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setDirty(true);
                  }}
                >
                  {meta.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Model name"
                />
              )}
            </div>

            {/* API key */}
            {meta.hasApiKey && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 pr-10 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-muted"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Base URL */}
            {meta.hasBaseUrl && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
                  Base URL
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="http://localhost:11434"
                />
              </div>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                testResult.success
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400",
              )}
            >
              {testResult.success ? "\u2713" : "\u2717"} {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {dirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface-base hover:bg-accent disabled:opacity-50"
              >
                {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            )}
            <button
              type="button"
              onClick={handleTest}
              disabled={testMutation.isPending}
              className="flex items-center gap-1.5 rounded-md border border-surface-highlight px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-text-primary disabled:opacity-50"
            >
              {testMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Test Connection
            </button>
          </div>
        </div>
      )}

      {/* Other providers */}
      {otherProviders.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-text-ghost hover:text-text-muted transition-colors"
          >
            {showOthers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showOthers ? "Hide" : "Show"} other providers ({otherProviders.length})
          </button>

          {showOthers && (
            <div className="mt-3 space-y-2">
              {otherProviders.map((p) => (
                <OtherProviderRow
                  key={p.provider_type}
                  provider={p}
                  onActivate={() => {
                    activateMutation.mutate(p.provider_type);
                    if (!p.is_enabled) {
                      toggleMutation.mutate({ type: p.provider_type, enabled: true });
                    }
                  }}
                  isActivating={activateMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
