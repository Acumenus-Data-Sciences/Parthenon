import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquareCode,
  Database,
  Sparkles,
  ChevronDown,
  Shield,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { QueryLibraryTab } from "../components/QueryLibraryTab";
import { NaturalLanguageTab } from "../components/NaturalLanguageTab";
import { fetchAppSettings, updateAppSettings } from "../api";
import { useAuthStore } from "@/stores/authStore";

type Tab = "library" | "natural-language";

export default function QueryAssistantPage() {
  const { t } = useTranslation("app");
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const queryClient = useQueryClient();

  const { data: appSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchAppSettings,
    staleTime: 5 * 60 * 1000,
  });

  const [localDialect, setLocalDialect] = useState<string | null>(null);

  const updateDialectMutation = useMutation({
    mutationFn: (dialect: string) =>
      updateAppSettings({ default_sql_dialect: dialect }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });

  const defaultDialect = appSettings?.default_sql_dialect ?? "postgresql";
  const activeDialect = localDialect ?? defaultDialect;
  const dialects = appSettings?.available_dialects ?? [];

  const handleDialectChange = (value: string) => {
    setLocalDialect(value);
    if (isSuperAdmin) {
      updateDialectMutation.mutate(value);
    }
  };

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            backgroundColor: "rgba(155, 27, 48, 0.18)",
            flexShrink: 0,
          }}
        >
          <MessageSquareCode size={22} style={{ color: "var(--primary)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            {t("queryAssistant.page.title")}
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              margin: "2px 0 0",
            }}
          >
            {t("queryAssistant.page.subtitle")}
          </p>
        </div>

        {/* Dialect selector */}
        {dialects.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontWeight: 600,
              }}
            >
              {t("queryAssistant.page.dialect")}
            </span>
            <div style={{ position: "relative" }}>
              <select
                value={activeDialect}
                onChange={(e) => handleDialectChange(e.target.value)}
                style={{
                  appearance: "none",
                  background: "var(--surface-raised)",
                  border: "1px solid #232328",
                  borderRadius: "8px",
                  padding: "7px 32px 7px 12px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  outline: "none",
                  transition: "border-color 150ms",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--surface-elevated)";
                }}
              >
                {dialects.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
            </div>
            {isSuperAdmin && (
              <span
                title={t("queryAssistant.page.defaultTooltip")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 8px",
                  borderRadius: "20px",
                  border: "1px solid #C9A22730",
                  background: "#C9A22708",
                  color: "var(--accent)",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "default",
                }}
              >
                <Shield size={10} />
                {t("queryAssistant.page.default")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          marginBottom: "24px",
          borderBottom: "1px solid #232328",
        }}
      >
        <TabButton
          active={activeTab === "library"}
          onClick={() => setActiveTab("library")}
          icon={<Database size={15} />}
          label={t("queryAssistant.page.tabs.library")}
        />
        <TabButton
          active={activeTab === "natural-language"}
          onClick={() => setActiveTab("natural-language")}
          icon={<Sparkles size={15} />}
          label={t("queryAssistant.page.tabs.naturalLanguage")}
        />
      </div>

      {/* Tab content */}
      {activeTab === "library" ? (
        <QueryLibraryTab dialect={activeDialect} />
      ) : (
        <NaturalLanguageTab />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 20px",
        background: "none",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        fontSize: "14px",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 150ms",
        marginBottom: "-1px",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.borderBottomColor = "var(--surface-highlight)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.borderBottomColor = "transparent";
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
}
