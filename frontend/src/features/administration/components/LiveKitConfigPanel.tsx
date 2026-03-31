import { useState, useEffect } from "react";
import { Phone, Cloud, Server, Wifi, WifiOff, Check, Loader2, Settings2 } from "lucide-react";
import { Panel, Badge, StatusDot, Button, FormInput, toast } from "@/components/ui";
import type { SystemHealthService } from "@/types/models";
import {
  useLiveKitConfig,
  useUpdateLiveKitConfig,
  useTestLiveKitConnection,
} from "../hooks/useAiProviders";

interface LiveKitConfigPanelProps {
  service: SystemHealthService;
}

type Provider = "cloud" | "self-hosted" | "env";

const STATUS_MAP = {
  healthy: { badge: "success" as const, dot: "healthy" as const },
  degraded: { badge: "warning" as const, dot: "degraded" as const },
  down: { badge: "critical" as const, dot: "critical" as const },
};

export function LiveKitConfigPanel({ service }: LiveKitConfigPanelProps) {
  const { data: config, isLoading } = useLiveKitConfig();
  const updateConfig = useUpdateLiveKitConfig();
  const testConnection = useTestLiveKitConnection();

  const [expanded, setExpanded] = useState(false);
  const [provider, setProvider] = useState<Provider>("env");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setUrl(config.url || config.env_url);
    }
  }, [config]);

  const { badge, dot } = STATUS_MAP[service.status] ?? STATUS_MAP.down;
  const details = service.details as { provider?: string; url?: string } | undefined;

  const handleTest = () => {
    const testUrl = provider === "env" ? (config?.env_url ?? "") : url;
    if (!testUrl) {
      toast.warning("No URL to test");
      return;
    }
    testConnection.mutate(testUrl, {
      onSuccess: (data) => {
        if (data.reachable) {
          toast.success("Connection successful");
        } else {
          toast.error("Connection failed");
        }
      },
      onError: () => {
        toast.error("Connection failed");
      },
    });
  };

  const handleSave = () => {
    updateConfig.mutate(
      { provider, url, api_key: apiKey || undefined, api_secret: apiSecret || undefined },
      {
        onSuccess: () => {
          toast.success("LiveKit configuration saved");
          setApiKey("");
          setApiSecret("");
        },
        onError: () => {
          toast.error("Failed to save configuration");
        },
      },
    );
  };

  return (
    <Panel className="h-full">
      {/* Status header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusDot status={dot} />
          <div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold text-foreground">{service.name}</p>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{service.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {details?.provider && (
            <Badge variant="info">
              {details.provider === "cloud" ? "Cloud" : details.provider === "self-hosted" ? "Self-hosted" : "Env"}
            </Badge>
          )}
          <Badge variant={badge}>{service.status}</Badge>
        </div>
      </div>

      {/* Configure button */}
      <div className="mt-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {expanded ? "Hide configuration" : "Configure LiveKit"}
        </button>
      </div>

      {/* Expanded config panel */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading configuration...
            </div>
          ) : (
            <>
              {/* Provider selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Provider</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "env", label: "Environment", icon: Server, desc: "Use .env file" },
                    { value: "cloud", label: "LiveKit Cloud", icon: Cloud, desc: "Hosted by LiveKit" },
                    { value: "self-hosted", label: "Self-hosted", icon: Server, desc: "Your own server" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setProvider(opt.value)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        provider === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <opt.icon className={`mb-1 h-4 w-4 ${provider === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Env info */}
              {provider === "env" && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                  <p className="font-medium text-foreground">Using .env configuration</p>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>URL: <span className="font-mono text-foreground">{config?.env_url || "Not set"}</span></p>
                    <p>API Key: {config?.env_has_key ? <Check className="inline h-3.5 w-3.5 text-emerald-500" /> : <span className="text-destructive">Missing</span>}</p>
                    <p>API Secret: {config?.env_has_secret ? <Check className="inline h-3.5 w-3.5 text-emerald-500" /> : <span className="text-destructive">Missing</span>}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Edit <code className="rounded bg-muted px-1">backend/.env</code> and restart PHP to change.
                  </p>
                </div>
              )}

              {/* Cloud / Self-hosted config */}
              {provider !== "env" && (
                <div className="space-y-3">
                  <FormInput
                    label={provider === "cloud" ? "LiveKit Cloud URL" : "Server URL"}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={provider === "cloud" ? "wss://your-project.livekit.cloud" : "wss://livekit.yourdomain.com"}
                  />
                  <FormInput
                    label="API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={config?.has_api_key ? "••••••• (saved, enter new to replace)" : "Enter API key"}
                  />
                  <FormInput
                    label="API Secret"
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder={config?.has_api_secret ? "••••••• (saved, enter new to replace)" : "Enter API secret"}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTest}
                  disabled={testConnection.isPending}
                >
                  {testConnection.isPending ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : testConnection.isSuccess && testConnection.data?.reachable ? (
                    <Wifi className="mr-1 h-3.5 w-3.5 text-emerald-500" />
                  ) : testConnection.isError ? (
                    <WifiOff className="mr-1 h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Wifi className="mr-1 h-3.5 w-3.5" />
                  )}
                  Test connection
                </Button>
                {provider !== "env" && (
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateConfig.isPending || !url}
                  >
                    {updateConfig.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    Save configuration
                  </Button>
                )}
                {provider === "env" && (
                  <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
                    {updateConfig.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    Use .env defaults
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
