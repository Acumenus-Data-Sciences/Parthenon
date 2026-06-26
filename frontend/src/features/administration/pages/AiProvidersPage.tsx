import { useMemo, useState } from "react";
import { Archive, Bot, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Plus, Radio, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpButton } from "@/features/help";
import { Panel, Badge, Button } from "@/components/ui";
import type { AiProviderSetting } from "@/types/models";
import {
  useActivateAiProvider,
  useAbbyPolicy,
  useAgentSettings,
  useAiProviders,
  useArchiveAbbyProviderProfile,
  useCreateAbbyProviderProfile,
  useDeleteAbbyProviderProfile,
  useSetAgentProviderMode,
  useSetAgentSettings,
  useSimulateAbbyRoute,
  useTestAiProvider,
  useUpdateAbbyProviderProfile,
  useUpdateAbbySurfacePolicy,
  useToggleAiProvider,
  useUpdateAiProvider,
} from "../hooks/useAiProviders";
import type {
  AbbyPolicyPayload,
  AbbyProviderMode,
  AbbyProviderProfile,
  AbbyProviderProfilePayload,
  AgentProviderMode,
} from "../api/adminApi";

// ── Provider metadata ─────────────────────────────────────────────────────────

interface ProviderMeta {
  region: "US" | "EU" | "China" | "Local";
  regionBadge: "info" | "success" | "critical" | "inactive";
  models: string[];
  hasApiKey: boolean;
  hasBaseUrl: boolean;
  defaultBaseUrl?: string;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  ollama: {
    region: "Local",
    regionBadge: "inactive",
    models: ["puyangwang/medgemma-27b-it:q4_0", "MedAIBase/MedGemma1.5:4b", "llama3.2", "gemma3:4b", "mistral"],
    hasApiKey: false,
    hasBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
  },
  anthropic: {
    region: "US",
    regionBadge: "info",
    models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
  openai: {
    region: "US",
    regionBadge: "info",
    models: ["gpt-5.5", "gpt-4o", "gpt-4o-mini", "o3-mini"],
    hasApiKey: true,
    hasBaseUrl: true,
  },
  gemini: {
    region: "US",
    regionBadge: "info",
    models: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
    hasApiKey: true,
    hasBaseUrl: false,
  },
  deepseek: {
    region: "China",
    regionBadge: "critical",
    models: ["deepseek-chat", "deepseek-reasoner"],
    hasApiKey: true,
    hasBaseUrl: true,
    defaultBaseUrl: "https://api.deepseek.com",
  },
  qwen: {
    region: "China",
    regionBadge: "critical",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    hasApiKey: true,
    hasBaseUrl: true,
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  moonshot: {
    region: "China",
    regionBadge: "critical",
    models: ["moonshot-v1-128k"],
    hasApiKey: true,
    hasBaseUrl: true,
    defaultBaseUrl: "https://api.moonshot.cn/v1",
  },
  mistral: {
    region: "EU",
    regionBadge: "success",
    models: ["mistral-large-latest", "mistral-medium"],
    hasApiKey: true,
    hasBaseUrl: true,
    defaultBaseUrl: "https://api.mistral.ai/v1",
  },
};

const FIELD_CLASS = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL_CLASS = "mb-1 block text-xs font-medium uppercase text-muted-foreground";

interface ProfileFormState {
  profile_id: string;
  display_name: string;
  provider_type: string;
  transport: string;
  entitlement_type: string;
  model: string;
  base_url: string;
  provider_setting_type: string;
  is_enabled: boolean;
  capabilities: string[];
  patient_level_context_allowed: boolean;
  phi_allowed: boolean;
  cloud: boolean;
  monthly_budget_usd: string;
  timeout_seconds: string;
  max_output_tokens: string;
  notes: string;
}

interface SurfaceFormState {
  provider_mode: AbbyProviderMode;
  default_profile_id: string;
  fallback_profile_ids: string[];
  never_send_phi_to_cloud: boolean;
  allow_cloud: boolean;
  required_capabilities: string[];
}

function createDefaultProfileForm(): ProfileFormState {
  return {
    profile_id: "local-medgemma-27b",
    display_name: "Local MedGemma 27B",
    provider_type: "ollama",
    transport: "ollama_chat",
    entitlement_type: "local",
    model: "puyangwang/medgemma-27b-it:q4_0",
    base_url: "http://localhost:11434",
    provider_setting_type: "",
    is_enabled: true,
    capabilities: ["chat", "streaming", "clinical_rag", "patient_level_local_only"],
    patient_level_context_allowed: true,
    phi_allowed: true,
    cloud: false,
    monthly_budget_usd: "",
    timeout_seconds: "60",
    max_output_tokens: "4096",
    notes: "",
  };
}

function createDefaultSurfaceForm(): SurfaceFormState {
  return {
    provider_mode: "local_first",
    default_profile_id: "",
    fallback_profile_ids: [],
    never_send_phi_to_cloud: true,
    allow_cloud: false,
    required_capabilities: ["chat", "streaming"],
  };
}

function surfaceFormFromData(data: AbbyPolicyPayload | undefined, surface: string): SurfaceFormState {
  if (!data) return createDefaultSurfaceForm();

  const policy = data.surface_policies.find((item) => item.surface === surface);
  const localDefault = data.profiles.find((profile) => profile.is_enabled && profile.transport === "ollama_chat");
  const requirements = data.catalog.surface_requirements[surface] ?? ["chat"];

  return {
    provider_mode: policy?.provider_mode ?? "local_first",
    default_profile_id: policy?.default_profile_id ?? localDefault?.profile_id ?? data.profiles[0]?.profile_id ?? "",
    fallback_profile_ids: policy?.fallback_profile_ids ?? [],
    never_send_phi_to_cloud: policy?.never_send_phi_to_cloud ?? true,
    allow_cloud: policy?.allow_cloud ?? false,
    required_capabilities: policy?.required_capabilities ?? requirements,
  };
}

function toggleListValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitNotes(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function profileToForm(profile: AbbyProviderProfile): ProfileFormState {
  const safety = profile.safety ?? {};
  const limits = profile.limits ?? {};

  return {
    profile_id: profile.profile_id,
    display_name: profile.display_name,
    provider_type: profile.provider_type,
    transport: profile.transport,
    entitlement_type: profile.entitlement_type,
    model: profile.model,
    base_url: profile.base_url ?? "",
    provider_setting_type: profile.provider_setting_type ?? "",
    is_enabled: profile.is_enabled,
    capabilities: profile.capabilities ?? [],
    patient_level_context_allowed: safety.patient_level_context_allowed === true,
    phi_allowed: safety.phi_allowed === true,
    cloud: safety.cloud === true,
    monthly_budget_usd: limits.monthly_budget_usd !== undefined ? String(limits.monthly_budget_usd) : "",
    timeout_seconds: limits.timeout_seconds !== undefined
      ? String(limits.timeout_seconds)
      : limits.timeout !== undefined
        ? String(limits.timeout)
        : "",
    max_output_tokens: limits.max_output_tokens !== undefined ? String(limits.max_output_tokens) : "",
    notes: (profile.notes ?? []).join("\n"),
  };
}

function profilePayloadFromForm(form: ProfileFormState, includeProfileId: boolean): AbbyProviderProfilePayload {
  const monthlyBudgetUsd = optionalNumber(form.monthly_budget_usd);
  const timeoutSeconds = optionalNumber(form.timeout_seconds);
  const maxOutputTokens = optionalNumber(form.max_output_tokens);
  const limits: Record<string, number> = {};

  if (monthlyBudgetUsd !== undefined) limits.monthly_budget_usd = monthlyBudgetUsd;
  if (timeoutSeconds !== undefined) limits.timeout_seconds = timeoutSeconds;
  if (maxOutputTokens !== undefined) limits.max_output_tokens = maxOutputTokens;

  return {
    ...(includeProfileId ? { profile_id: form.profile_id.trim() } : {}),
    display_name: form.display_name.trim(),
    provider_type: form.provider_type.trim(),
    transport: form.transport,
    entitlement_type: form.entitlement_type,
    model: form.model.trim(),
    base_url: form.base_url.trim() || null,
    provider_setting_type: form.provider_setting_type.trim() || null,
    is_enabled: form.is_enabled,
    capabilities: form.capabilities,
    safety: {
      cloud: form.cloud,
      phi_allowed: form.phi_allowed,
      patient_level_context_allowed: form.patient_level_context_allowed,
    },
    limits,
    notes: splitNotes(form.notes),
  };
}

function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]>; references?: Array<{ surface: string; role: string }> } } })?.response;
  const data = response?.data;
  const validation = data?.errors
    ? Object.entries(data.errors)
      .flatMap(([key, values]) => values.map((value) => `${key}: ${value}`))
      .join("; ")
    : "";
  const references = data?.references?.map((item) => `${item.surface}/${item.role}`).join(", ");

  return [data?.message, validation, references ? `References: ${references}` : ""]
    .filter(Boolean)
    .join(" ");
}

function AbbyBehaviorCard() {
  const { t } = useTranslation("app");
  const { data, isLoading } = useAbbyPolicy();
  const createProfile = useCreateAbbyProviderProfile();
  const updateProfile = useUpdateAbbyProviderProfile();
  const archiveProfile = useArchiveAbbyProviderProfile();
  const deleteProfile = useDeleteAbbyProviderProfile();
  const updateSurfacePolicy = useUpdateAbbySurfacePolicy();
  const simulateRoute = useSimulateAbbyRoute();
  const [surface, setSurface] = useState("chat");
  const [message, setMessage] = useState("Summarize this study design.");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => createDefaultProfileForm());
  const [surfaceDrafts, setSurfaceDrafts] = useState<Record<string, SurfaceFormState>>({});
  const [profileError, setProfileError] = useState("");
  const [surfaceError, setSurfaceError] = useState("");

  const surfaces = data?.catalog.surfaces ?? ["chat"];
  const selectedSurfacePolicy = data?.surface_policies.find((policy) => policy.surface === surface);
  const selectedProfile = data?.profiles.find((profile) => profile.profile_id === selectedSurfacePolicy?.default_profile_id);
  const profileOptions = data?.profiles ?? [];
  const capabilityOptions = data?.catalog.capabilities ?? createDefaultProfileForm().capabilities;
  const result = simulateRoute.data;
  const profileSavePending = createProfile.isPending || updateProfile.isPending;
  const profileLifecyclePending = archiveProfile.isPending || deleteProfile.isPending;
  const surfaceSavePending = updateSurfacePolicy.isPending;
  const surfaceForm = useMemo(
    () => surfaceDrafts[surface] ?? surfaceFormFromData(data, surface),
    [data, surface, surfaceDrafts],
  );

  function updateSurfaceForm(updater: (form: SurfaceFormState) => SurfaceFormState) {
    setSurfaceDrafts((drafts) => ({
      ...drafts,
      [surface]: updater(drafts[surface] ?? surfaceFormFromData(data, surface)),
    }));
  }

  function resetProfileForm() {
    setEditingProfileId(null);
    setProfileError("");
    setProfileForm(createDefaultProfileForm());
  }

  function handleSaveProfile() {
    setProfileError("");
    const payload = profilePayloadFromForm(profileForm, editingProfileId === null);

    if (editingProfileId) {
      updateProfile.mutate(
        { profileId: editingProfileId, data: payload },
        {
          onSuccess: (profile) => {
            setEditingProfileId(profile.profile_id);
            setProfileForm(profileToForm(profile));
          },
          onError: (error) => setProfileError(errorMessage(error)),
        },
      );
    } else {
      createProfile.mutate(payload, {
        onSuccess: resetProfileForm,
        onError: (error) => setProfileError(errorMessage(error)),
      });
    }
  }

  function handleArchiveProfile(profileId: string) {
    setProfileError("");
    archiveProfile.mutate(profileId, {
      onError: (error) => setProfileError(errorMessage(error)),
    });
  }

  function handleDeleteProfile(profileId: string) {
    setProfileError("");
    deleteProfile.mutate(profileId, {
      onSuccess: () => {
        if (editingProfileId === profileId) resetProfileForm();
      },
      onError: (error) => setProfileError(errorMessage(error)),
    });
  }

  function handleSaveSurfacePolicy() {
    setSurfaceError("");
    updateSurfacePolicy.mutate(
      {
        surface,
        data: {
          provider_mode: surfaceForm.provider_mode,
          default_profile_id: surfaceForm.default_profile_id || null,
          fallback_profile_ids: surfaceForm.fallback_profile_ids.filter((profileId) => profileId !== surfaceForm.default_profile_id),
          never_send_phi_to_cloud: surfaceForm.never_send_phi_to_cloud,
          allow_cloud: surfaceForm.allow_cloud,
          required_capabilities: surfaceForm.required_capabilities,
          settings: selectedSurfacePolicy?.settings ?? {},
        },
      },
      {
        onSuccess: () => setSurfaceDrafts((drafts) => {
          const next = { ...drafts };
          delete next[surface];

          return next;
        }),
        onError: (error) => setSurfaceError(errorMessage(error)),
      },
    );
  }

  return (
    <Panel>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Bot className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">
              {t("administration.aiProviders.abbyBehavior.title", "Abby behavior")}
            </span>
            {selectedSurfacePolicy && (
              <Badge variant={selectedSurfacePolicy.allow_cloud ? "info" : "inactive"}>
                {selectedSurfacePolicy.provider_mode}
              </Badge>
            )}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <span className="block text-xs uppercase text-muted-foreground">
                {t("administration.aiProviders.abbyBehavior.profiles", "Profiles")}
              </span>
              <span className="text-foreground">{isLoading ? "..." : data?.profiles.length ?? 0}</span>
            </div>
            <div>
              <span className="block text-xs uppercase text-muted-foreground">
                {t("administration.aiProviders.abbyBehavior.chatProfile", "Chat profile")}
              </span>
              <span className="break-words text-foreground">
                {selectedProfile?.display_name ?? selectedSurfacePolicy?.default_profile_id ?? "local default"}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase text-muted-foreground">
                {t("administration.aiProviders.abbyBehavior.phiLock", "PHI lock")}
              </span>
              <span className="text-foreground">
                {selectedSurfacePolicy?.never_send_phi_to_cloud
                  ? t("administration.aiProviders.values.enabled", "Enabled")
                  : t("administration.aiProviders.values.disabled", "Disabled")}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("administration.aiProviders.abbyBehavior.profileEditor", "Provider profile")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {editingProfileId ?? t("administration.aiProviders.abbyBehavior.newProfile", "new profile")}
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={resetProfileForm}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("administration.aiProviders.abbyBehavior.newProfile", "New profile")}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.profileId", "Profile ID")}
                  </span>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={profileForm.profile_id}
                    disabled={editingProfileId !== null}
                    onChange={(event) => setProfileForm((form) => ({ ...form, profile_id: event.target.value }))}
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.displayName", "Display name")}
                  </span>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={profileForm.display_name}
                    onChange={(event) => setProfileForm((form) => ({ ...form, display_name: event.target.value }))}
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.providerType", "Provider")}
                  </span>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={profileForm.provider_type}
                    onChange={(event) => setProfileForm((form) => ({ ...form, provider_type: event.target.value }))}
                    placeholder="openai, anthropic, ollama, mistral"
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.transport", "Transport")}
                  </span>
                  <select
                    className={FIELD_CLASS}
                    value={profileForm.transport}
                    onChange={(event) => {
                      const transport = event.target.value;
                      setProfileForm((form) => ({
                        ...form,
                        transport,
                        entitlement_type: transport === "ollama_chat"
                          ? "local"
                          : transport === "external_subscription_app"
                            ? "external_subscription_app"
                            : form.entitlement_type === "local"
                              ? "org_api_key"
                              : form.entitlement_type,
                        provider_type: transport === "ollama_chat" ? "ollama" : form.provider_type,
                        base_url: transport === "ollama_chat" && form.base_url === "" ? "http://localhost:11434" : form.base_url,
                        cloud: transport !== "ollama_chat",
                      }));
                    }}
                  >
                    {(data?.catalog.transports ?? ["ollama_chat"]).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.entitlement", "Entitlement")}
                  </span>
                  <select
                    className={FIELD_CLASS}
                    value={profileForm.entitlement_type}
                    onChange={(event) => setProfileForm((form) => ({ ...form, entitlement_type: event.target.value }))}
                  >
                    {(data?.catalog.entitlements ?? ["local"]).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.fields.model", "Model")}
                  </span>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={profileForm.model}
                    onChange={(event) => setProfileForm((form) => ({ ...form, model: event.target.value }))}
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.fields.baseUrl", "Base URL")}
                  </span>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={profileForm.base_url}
                    onChange={(event) => setProfileForm((form) => ({ ...form, base_url: event.target.value }))}
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.providerSettingType", "Key source")}
                  </span>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={profileForm.provider_setting_type}
                    onChange={(event) => setProfileForm((form) => ({ ...form, provider_setting_type: event.target.value }))}
                    placeholder={profileForm.provider_type}
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.fields.monthlyBudgetUsd", "Monthly budget USD")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={FIELD_CLASS}
                    value={profileForm.monthly_budget_usd}
                    onChange={(event) => setProfileForm((form) => ({ ...form, monthly_budget_usd: event.target.value }))}
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.fields.timeout", "Timeout seconds")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    className={FIELD_CLASS}
                    value={profileForm.timeout_seconds}
                    onChange={(event) => setProfileForm((form) => ({ ...form, timeout_seconds: event.target.value }))}
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.fields.maxOutputTokens", "Max output tokens")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    className={FIELD_CLASS}
                    value={profileForm.max_output_tokens}
                    onChange={(event) => setProfileForm((form) => ({ ...form, max_output_tokens: event.target.value }))}
                  />
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.notes", "Notes")}
                  </span>
                  <textarea
                    className={`${FIELD_CLASS} min-h-10 resize-y`}
                    value={profileForm.notes}
                    onChange={(event) => setProfileForm((form) => ({ ...form, notes: event.target.value }))}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.capabilities", "Capabilities")}
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {capabilityOptions.map((capability) => (
                      <label key={capability} className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={profileForm.capabilities.includes(capability)}
                          onChange={() => setProfileForm((form) => ({
                            ...form,
                            capabilities: toggleListValue(form.capabilities, capability),
                          }))}
                        />
                        <span className="break-words">{capability}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.safety", "Safety")}
                  </span>
                  <div className="space-y-2">
                    {[
                      ["is_enabled", t("administration.aiProviders.values.enabled", "Enabled")],
                      ["cloud", t("administration.aiProviders.abbyBehavior.cloud", "Cloud")],
                      ["phi_allowed", t("administration.aiProviders.abbyBehavior.phiAllowed", "PHI allowed")],
                      ["patient_level_context_allowed", t("administration.aiProviders.abbyBehavior.patientContext", "Patient context")],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={profileForm[key as keyof ProfileFormState] === true}
                          onChange={() => setProfileForm((form) => ({
                            ...form,
                            [key]: !(form[key as keyof ProfileFormState] === true),
                          }))}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {profileError && (
                <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {profileError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={profileSavePending || profileForm.profile_id.trim() === "" || profileForm.display_name.trim() === "" || profileForm.model.trim() === ""}
                >
                  {profileSavePending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                  {editingProfileId
                    ? t("administration.aiProviders.abbyBehavior.updateProfile", "Update profile")
                    : t("administration.aiProviders.abbyBehavior.createProfile", "Create profile")}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("administration.aiProviders.abbyBehavior.surfacePolicy", "Surface policy")}
                </h2>
                <p className="text-xs text-muted-foreground">{surface}</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.surface", "Surface")}
                  </span>
                  <select
                    className={FIELD_CLASS}
                    value={surface}
                    onChange={(event) => setSurface(event.target.value)}
                  >
                    {surfaces.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.mode", "Mode")}
                  </span>
                  <select
                    className={FIELD_CLASS}
                    value={surfaceForm.provider_mode}
                    onChange={(event) => updateSurfaceForm((form) => ({
                      ...form,
                      provider_mode: event.target.value as AbbyProviderMode,
                    }))}
                  >
                    {(data?.catalog.modes ?? ["local_first"]).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={LABEL_CLASS}>
                    {t("administration.aiProviders.abbyBehavior.defaultProfile", "Default profile")}
                  </span>
                  <select
                    className={FIELD_CLASS}
                    value={surfaceForm.default_profile_id}
                    onChange={(event) => {
                      const defaultProfileId = event.target.value;
                      updateSurfaceForm((form) => ({
                        ...form,
                        default_profile_id: defaultProfileId,
                        fallback_profile_ids: form.fallback_profile_ids.filter((profileId) => profileId !== defaultProfileId),
                      }));
                    }}
                  >
                    <option value="">{t("administration.aiProviders.abbyBehavior.none", "None")}</option>
                    {profileOptions.map((profile) => (
                      <option key={profile.profile_id} value={profile.profile_id}>
                        {profile.display_name} / {profile.profile_id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <span className={LABEL_CLASS}>
                  {t("administration.aiProviders.abbyBehavior.fallbacks", "Fallbacks")}
                </span>
                <div className="space-y-2">
                  {profileOptions.map((profile) => (
                    <label key={profile.profile_id} className="flex items-start gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={surfaceForm.fallback_profile_ids.includes(profile.profile_id)}
                        disabled={surfaceForm.default_profile_id === profile.profile_id}
                        onChange={() => updateSurfaceForm((form) => ({
                          ...form,
                          fallback_profile_ids: toggleListValue(form.fallback_profile_ids, profile.profile_id),
                        }))}
                      />
                      <span className="min-w-0 break-words">
                        {profile.display_name}
                        <span className="block text-xs text-muted-foreground">{profile.profile_id}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className={LABEL_CLASS}>
                  {t("administration.aiProviders.abbyBehavior.requiredCapabilities", "Required capabilities")}
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {capabilityOptions.map((capability) => (
                    <label key={capability} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={surfaceForm.required_capabilities.includes(capability)}
                        onChange={() => updateSurfaceForm((form) => ({
                          ...form,
                          required_capabilities: toggleListValue(form.required_capabilities, capability),
                        }))}
                      />
                      <span className="break-words">{capability}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={surfaceForm.allow_cloud}
                    onChange={() => updateSurfaceForm((form) => ({ ...form, allow_cloud: !form.allow_cloud }))}
                  />
                  <span>{t("administration.aiProviders.abbyBehavior.allowCloud", "Allow cloud")}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={surfaceForm.never_send_phi_to_cloud}
                    onChange={() => updateSurfaceForm((form) => ({
                      ...form,
                      never_send_phi_to_cloud: !form.never_send_phi_to_cloud,
                    }))}
                  />
                  <span>{t("administration.aiProviders.abbyBehavior.neverSendPhi", "Never send PHI to cloud")}</span>
                </label>
              </div>

              {surfaceError && (
                <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {surfaceError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSurfacePolicy}
                  disabled={surfaceSavePending || surfaceForm.provider_mode !== "disabled" && surfaceForm.default_profile_id === ""}
                >
                  {surfaceSavePending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                  {t("administration.aiProviders.abbyBehavior.savePolicy", "Save policy")}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {profileOptions.map((profile) => (
                <div key={profile.profile_id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-words text-sm font-medium text-foreground">{profile.display_name}</span>
                        <Badge variant={profile.is_enabled ? "success" : "inactive"}>
                          {profile.is_enabled
                            ? t("administration.aiProviders.values.enabled", "Enabled")
                            : t("administration.aiProviders.values.disabled", "Disabled")}
                        </Badge>
                        <Badge variant={profile.transport === "ollama_chat" ? "inactive" : "info"}>
                          {profile.transport}
                        </Badge>
                      </div>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {profile.profile_id} / {profile.provider_type} / {profile.model}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setProfileError("");
                          setEditingProfileId(profile.profile_id);
                          setProfileForm(profileToForm(profile));
                        }}
                      >
                        {t("administration.aiProviders.abbyBehavior.edit", "Edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={profileLifecyclePending || !profile.is_enabled}
                        onClick={() => handleArchiveProfile(profile.profile_id)}
                      >
                        {archiveProfile.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Archive className="mr-1 h-3.5 w-3.5" />}
                        {t("administration.aiProviders.abbyBehavior.archive", "Archive")}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={profileLifecyclePending}
                        onClick={() => handleDeleteProfile(profile.profile_id)}
                      >
                        {deleteProfile.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                        {t("administration.aiProviders.abbyBehavior.delete", "Delete")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-[180px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              simulateRoute.mutate({ surface, message, page_context: "administration" });
            }}
          >
            <select
              className={FIELD_CLASS}
              value={surface}
              onChange={(event) => setSurface(event.target.value)}
            >
              {surfaces.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input
              type="text"
              className={FIELD_CLASS}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={simulateRoute.isPending || message.trim() === ""}
            >
              {simulateRoute.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {t("administration.aiProviders.abbyBehavior.simulate", "Simulate")}
            </Button>
          </form>

          {result && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border border-border p-3 text-sm sm:grid-cols-3">
              <div>
                <span className="block text-xs uppercase text-muted-foreground">
                  {t("administration.aiProviders.abbyBehavior.routeReason", "Route reason")}
                </span>
                <span className="text-foreground">{result.reason}</span>
              </div>
              <div>
                <span className="block text-xs uppercase text-muted-foreground">
                  {t("administration.aiProviders.abbyBehavior.selectedProfile", "Selected")}
                </span>
                <span className="break-words text-foreground">
                  {result.selected_profile?.profile_id ?? "none"}
                </span>
              </div>
              <div>
                <span className="block text-xs uppercase text-muted-foreground">
                  {t("administration.aiProviders.abbyBehavior.cost", "Cost")}
                </span>
                <span className="text-foreground">
                  {result.will_call_paid_provider
                    ? t("administration.aiProviders.abbyBehavior.paidProvider", "Paid provider")
                    : t("administration.aiProviders.abbyBehavior.zeroApiCost", "Zero API cost")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ── AI Agents toggle card ─────────────────────────────────────────────────────

function AgentsToggleCard() {
  const { t } = useTranslation("app");
  const { data, isLoading } = useAgentSettings();
  const setAgents = useSetAgentSettings();
  const setProviderMode = useSetAgentProviderMode();

  const enabled = data?.enabled ?? false;
  const anthropicReady = data?.anthropic_ready ?? false;
  const providerMode: AgentProviderMode = data?.provider_mode ?? "cloud";
  const localReady = data?.local_ready ?? false;

  const modeOptions: Array<{ value: AgentProviderMode; label: string; hint: string }> = [
    {
      value: "cloud",
      label: t("admin.agents.mode.cloud", "Cloud (Claude)"),
      hint: t("admin.agents.mode.cloudHint", "Copilots run on the Anthropic API."),
    },
    {
      value: "local",
      label: t("admin.agents.mode.local", "Local model"),
      hint: t("admin.agents.mode.localHint", "Copilots run on the local model via the claude-router proxy."),
    },
    {
      value: "auto",
      label: t("admin.agents.mode.auto", "Auto"),
      hint: t("admin.agents.mode.autoHint", "Local when a local provider is active, otherwise Cloud."),
    },
  ];

  return (
    <Panel>
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Bot className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {t("admin.agents.title", "AI Agents")}
            </span>
            {enabled && <Badge variant="primary">{t("administration.aiProviders.values.enabled", "Enabled")}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "admin.agents.description",
              "Enables the Claude Agent SDK copilots in Study Designer and Publish.",
            )}
          </p>
          {enabled && !anthropicReady && (
            <p className="mt-1 text-xs text-amber-500">
              {t(
                "admin.agents.notReady",
                "Anthropic provider not configured — agents won't run until a credited Anthropic key is set.",
              )}
            </p>
          )}
        </div>

        {/* Enable toggle */}
        <label
          className="relative inline-flex cursor-pointer items-center"
          aria-label={t("admin.agents.toggleLabel", "Toggle AI Agents")}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={enabled}
            disabled={isLoading || setAgents.isPending}
            onChange={(e) => setAgents.mutate(e.target.checked)}
          />
          <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-4" />
          <span className="ml-2 text-sm text-muted-foreground">
            {enabled
              ? t("administration.aiProviders.values.enabled", "Enabled")
              : t("administration.aiProviders.values.disabled", "Disabled")}
          </span>
        </label>

        {setAgents.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Copilot provider mode — which backend the action-taking copilots use. */}
      {enabled && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("admin.agents.mode.title", "Copilot provider")}
              </p>
              <p className="text-xs text-muted-foreground">
                {modeOptions.find((m) => m.value === providerMode)?.hint}
              </p>
            </div>
            <div
              className="inline-flex rounded-md border border-border bg-muted p-0.5"
              role="group"
              aria-label={t("admin.agents.mode.title", "Copilot provider")}
            >
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`copilot-mode-${opt.value}`}
                  disabled={isLoading || setProviderMode.isPending || providerMode === opt.value}
                  onClick={() => setProviderMode.mutate(opt.value)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    providerMode === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {(providerMode === "local" || providerMode === "auto") && !localReady && (
            <p className="mt-2 text-xs text-amber-500">
              {t(
                "admin.agents.mode.localNotReady",
                "No local provider is active — set an Ollama provider as Active below, and ensure the claude-router sidecar is running.",
              )}
            </p>
          )}
          {setProviderMode.isPending && (
            <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Provider card ─────────────────────────────────────────────────────────────

interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

function ProviderCard({ provider }: { provider: AiProviderSetting }) {
  const { t } = useTranslation("app");
  const meta = PROVIDER_META[provider.provider_type] ?? {
    region: "US" as const,
    regionBadge: "info" as const,
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
      : meta.defaultBaseUrl ?? "",
  );
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    provider.settings?.timeout !== undefined ? String(provider.settings.timeout) : "",
  );
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    provider.settings?.max_output_tokens !== undefined ? String(provider.settings.max_output_tokens) : "",
  );
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = useState(
    provider.settings?.monthly_budget_usd !== undefined ? String(provider.settings.monthly_budget_usd) : "",
  );
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [dirty, setDirty] = useState(false);

  const updateMutation = useUpdateAiProvider();
  const activateMutation = useActivateAiProvider();
  const toggleMutation = useToggleAiProvider();
  const testMutation = useTestAiProvider();

  function handleSave() {
    const settings: AiProviderSetting["settings"] = {};
    if (meta.hasApiKey) settings.api_key = apiKey;
    if (meta.hasBaseUrl) settings.base_url = baseUrl;
    if (timeoutSeconds.trim() !== "") settings.timeout = Number(timeoutSeconds);
    if (maxOutputTokens.trim() !== "") settings.max_output_tokens = Number(maxOutputTokens);
    if (monthlyBudgetUsd.trim() !== "") settings.monthly_budget_usd = Number(monthlyBudgetUsd);

    updateMutation.mutate(
      { type: provider.provider_type, data: { model, settings } },
      { onSuccess: () => setDirty(false) },
    );
  }

  function handleTest() {
    setTestResult(null);

    const runTest = () => {
      testMutation.mutate(provider.provider_type, {
        onSuccess: (r) => setTestResult(r),
        onError: () =>
          setTestResult({
            success: false,
            message: t("administration.aiProviders.messages.requestFailed"),
          }),
      });
    };

    // Auto-save unsaved settings before testing so the backend has the latest key
    if (dirty) {
      const settings: AiProviderSetting["settings"] = {};
      if (meta.hasApiKey) settings.api_key = apiKey;
      if (meta.hasBaseUrl) settings.base_url = baseUrl;
      if (timeoutSeconds.trim() !== "") settings.timeout = Number(timeoutSeconds);
      if (maxOutputTokens.trim() !== "") settings.max_output_tokens = Number(maxOutputTokens);
      if (monthlyBudgetUsd.trim() !== "") settings.monthly_budget_usd = Number(monthlyBudgetUsd);

      updateMutation.mutate(
        { type: provider.provider_type, data: { model, settings } },
        { onSuccess: () => { setDirty(false); runTest(); } },
      );
    } else {
      runTest();
    }
  }

  const isSaving = updateMutation.isPending;
  const isTesting = testMutation.isPending;

  return (
    <Panel className={provider.is_active ? "border-primary/50" : ""}>
      {/* Header row */}
      <div
        className="flex cursor-pointer items-center gap-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Bot className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{provider.display_name}</span>
            {provider.is_active && (
              <Badge variant="primary">
                {t("administration.aiProviders.values.active")}
              </Badge>
            )}
            <Badge variant={meta.regionBadge}>{meta.region}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {provider.model || t("administration.aiProviders.values.noModelSelected")}
          </p>
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
            {provider.is_enabled
              ? t("administration.aiProviders.values.enabled")
              : t("administration.aiProviders.values.disabled")}
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
        <div className="border-t border-border mt-4 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Model selector */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {t("administration.aiProviders.fields.model")}
              </label>
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
                    <option key={m} value={m}>{m}</option>
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
                  placeholder={t("administration.aiProviders.placeholders.modelName")}
                />
              )}
            </div>

            {/* API key or base URL */}
            {meta.hasApiKey && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  {t("administration.aiProviders.fields.apiKey")}
                </label>
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
                  {t("administration.aiProviders.fields.baseUrl", "Base URL")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    setDirty(true);
                  }}
                  placeholder={meta.defaultBaseUrl ?? "https://api.example.com/v1"}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {t("administration.aiProviders.fields.timeout", "Timeout seconds")}
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={timeoutSeconds}
                onChange={(e) => {
                  setTimeoutSeconds(e.target.value);
                  setDirty(true);
                }}
                placeholder="60"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {t("administration.aiProviders.fields.maxOutputTokens", "Max output tokens")}
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={maxOutputTokens}
                onChange={(e) => {
                  setMaxOutputTokens(e.target.value);
                  setDirty(true);
                }}
                placeholder="4096"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {t("administration.aiProviders.fields.monthlyBudgetUsd", "Monthly budget USD")}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={monthlyBudgetUsd}
                onChange={(e) => {
                  setMonthlyBudgetUsd(e.target.value);
                  setDirty(true);
                }}
                placeholder="500"
              />
            </div>
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => activateMutation.mutate(provider.provider_type)}
              disabled={provider.is_active || activateMutation.isPending}
            >
              <Radio className="h-3.5 w-3.5 mr-1" />
              {provider.is_active
                ? t("administration.aiProviders.actions.currentlyActive")
                : t("administration.aiProviders.actions.setAsActive")}
            </Button>

            {dirty && (
              <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                {t("administration.aiProviders.actions.save")}
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={handleTest} disabled={isTesting}>
              {isTesting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              {t("administration.aiProviders.actions.testConnection")}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AiProvidersPage() {
  const { t } = useTranslation("app");
  const { data: providers, isLoading } = useAiProviders();

  const activeProvider = providers?.find((p) => p.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("administration.aiProviders.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("administration.aiProviders.subtitle")}
          </p>
        </div>
        <HelpButton helpKey="admin.ai-providers" />
      </div>

      {/* AI Agents global toggle */}
      <AgentsToggleCard />

      <AbbyBehaviorCard />

      {/* Active provider banner */}
      {activeProvider && (
        <Panel>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-foreground">
              {t("administration.aiProviders.activeProvider")}{" "}
              <span className="font-semibold">{activeProvider.display_name}</span>
              {activeProvider.model && (
                <span className="ml-2 font-normal text-muted-foreground">
                  / {activeProvider.model}
                </span>
              )}
            </span>
            <Badge variant="success">
              {t("administration.aiProviders.values.active")}
            </Badge>
          </div>
        </Panel>
      )}

      {/* Provider list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {(providers ?? [])
            .slice()
            .sort((a, b) => {
              // Ollama (local) first, then alphabetical
              if (a.provider_type === "ollama") return -1;
              if (b.provider_type === "ollama") return 1;
              return a.provider_type.localeCompare(b.provider_type);
            })
            .map((p) => (
              <ProviderCard key={p.provider_type} provider={p} />
            ))}
        </div>
      )}
    </div>
  );
}
