import { useState } from "react";
import { Bot, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Radio } from "lucide-react";
import type { AiProviderSetting } from "@/types/models";
import {
  useActivateAiProvider,
  useAiProviders,
  useTestAiProvider,
  useToggleAiProvider,
  useUpdateAiProvider,
} from "../hooks/useAiProviders";

// ── Provider metadata ─────────────────────────────────────────────────────────

interface ProviderMeta {
  region: "US" | "EU" | "China" | "Local";
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

// ── Provider card ─────────────────────────────────────────────────────────────

interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

function ProviderCard({ provider }: { provider: AiProviderSetting }) {
  const meta = PROVIDER_META[provider.provider_type] ?? {
    region: "US" as const,
    regionColor: "bg-gray-500/10 text-gray-400",
    models: [],
    hasApiKey: true,
    hasBaseUrl: false,
  };

  const [expanded, setExpanded] = useState(provider.is_active);
  const [model, setModel] = useState(provider.model || meta.models[0] || "");
  const [apiKey, setApiKey] = useState(
    typeof provider.settings?.api_key === "string" ? provider.settings.api_key : "",
  );
  const [baseUrl, setBaseUrl] = useState(
    typeof provider.settings?.base_url === "string"
      ? provider.settings.base_url
      : "http://localhost:11434",
  );
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [dirty, setDirty] = useState(false);

  const updateMutation = useUpdateAiProvider();
  const activateMutation = useActivateAiProvider();
  const toggleMutation = useToggleAiProvider();
  const testMutation = useTestAiProvider();

  function handleSave() {
    const settings: Record<string, string> = {};
    if (meta.hasApiKey) settings.api_key = apiKey;
    if (meta.hasBaseUrl) settings.base_url = baseUrl;

    updateMutation.mutate(
      { type: provider.provider_type, data: { model, settings } },
      { onSuccess: () => setDirty(false) },
    );
  }

  function handleTest() {
    setTestResult(null);
    testMutation.mutate(provider.provider_type, {
      onSuccess: (r) => setTestResult(r),
      onError: () => setTestResult({ success: false, message: "Request failed." }),
    });
  }

  const isSaving = updateMutation.isPending;
  const isTesting = testMutation.isPending;

  return (
    <div
      className={`rounded-lg border bg-card transition-colors ${
        provider.is_active ? "border-primary/50" : "border-border"
      }`}
    >
      {/* Header row */}
      <div
        className="flex cursor-pointer items-center gap-4 p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Bot className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{provider.display_name}</span>
            {provider.is_active && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Active
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.regionColor}`}>
              {meta.region}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{provider.model || "No model selected"}</p>
        </div>

        {/* Enable toggle */}
        <label
          className="relative inline-flex cursor-pointer items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={provider.is_enabled}
            onChange={(e) =>
              toggleMutation.mutate({ type: provider.provider_type, enabled: e.target.checked })
            }
          />
          <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-4" />
          <span className="ml-2 text-sm text-muted-foreground">
            {provider.is_enabled ? "Enabled" : "Disabled"}
          </span>
        </label>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Model selector */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Model</label>
              {meta.models.length > 0 ? (
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Model name"
                />
              )}
            </div>

            {/* API key or base URL */}
            {meta.hasApiKey && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {meta.hasBaseUrl && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Ollama Base URL
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                testResult.success
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {testResult.success ? "✓" : "✗"} {testResult.message}
            </div>
          )}

          {/* Action row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Set as Active */}
            <button
              type="button"
              onClick={() => activateMutation.mutate(provider.provider_type)}
              disabled={provider.is_active || activateMutation.isPending}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Radio className="h-3.5 w-3.5" />
              {provider.is_active ? "Currently Active" : "Set as Active"}
            </button>

            {/* Save */}
            {dirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            )}

            {/* Test */}
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {isTesting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Test Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AiProvidersPage() {
  const { data: providers, isLoading } = useAiProviders();

  const activeProvider = providers?.find((p) => p.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Provider Configuration</h1>
        <p className="mt-1 text-muted-foreground">
          Choose which AI backend powers Abby. Only one provider is active at a time. API keys are
          stored encrypted.
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

      {/* Provider list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {(providers ?? []).map((p) => (
            <ProviderCard key={p.provider_type} provider={p} />
          ))}
        </div>
      )}
    </div>
  );
}
