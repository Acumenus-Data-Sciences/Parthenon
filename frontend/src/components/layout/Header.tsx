import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { useAbbyStore } from "@/stores/abbyStore";
import { LogOut, User, Search, Bell, Settings, ChevronDown, Database, Star, Globe } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import AbbyAvatar from "@/features/commons/components/abby/AbbyAvatar";
import { AboutAbbyModal } from "./AboutAbbyModal";
import { useSourceStore } from "@/stores/sourceStore";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type { Source } from "@/types/models";
import apiClient from "@/lib/api-client";
import { normalizeLocale, PUBLIC_SELECTABLE_LOCALES } from "@/i18n/locales";
import { setActiveLocale } from "@/i18n/i18n";

function UserDropdown() {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const avatarUrl = user?.avatar ? `/storage/${user.avatar}?v=${user.updated_at ?? ''}` : null;
  const [avatarError, setAvatarError] = useState(false);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="btn btn-ghost btn-sm"
        style={{ gap: "var(--space-1)" }}
      >
        {avatarUrl && !avatarError ? (
          <img
            src={avatarUrl}
            alt={user?.name ?? ""}
            className="w-6 h-6 rounded-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <User size={16} />
        )}
        <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          {user?.name}
        </span>
        <ChevronDown size={14} style={{ color: "var(--text-ghost)" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-48 rounded-lg border border-border-default bg-surface-raised shadow-xl z-50 py-1"
        >
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay transition-colors"
          >
            <Settings size={14} />
            {t("actions.settings")}
          </button>
          <div className="border-t border-border-default my-1" />
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-critical hover:bg-surface-overlay transition-colors"
          >
            <LogOut size={14} />
            {t("actions.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Initializes the active source from the user's per-user default.
 * Resets to the user's default on each fresh page load (session-only override).
 */
function useSourceInitializer() {
  const { user } = useAuthStore();
  const { setActiveSource, setSources, setDefaultSourceId } = useSourceStore();
  const { data: sources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  useEffect(() => {
    if (!sources?.length) return;
    setSources(sources.map((s: Source) => ({ id: s.id, source_name: s.source_name })));

    const userDefaultId = user?.default_source_id ?? null;
    setDefaultSourceId(userDefaultId);

    // Always reset to user's default on mount; fall back to first source
    const target = userDefaultId
      ? sources.find((s: Source) => s.id === userDefaultId)
      : null;
    setActiveSource(target ? target.id : sources[0].id);
  }, [sources, user?.default_source_id, setActiveSource, setSources, setDefaultSourceId]);
}

function HeaderSourceSelector() {
  const { activeSourceId, setActiveSource, defaultSourceId, sources } = useSourceStore();
  const { t } = useTranslation("layout");
  const navigate = useNavigate();

  if (!sources.length) return null;

  const selectedSource = sources.find((s) => s.id === activeSourceId);

  const handleChange = (id: number) => {
    setActiveSource(id);
    // If on a data-explorer route, update the URL too
    if (window.location.pathname.startsWith("/data-explorer")) {
      navigate(`/data-explorer/${id}`, { replace: true });
    }
  };

  return (
    <div className="relative flex items-center gap-1.5">
      {selectedSource && selectedSource.id === defaultSourceId ? (
        <Star size={13} className="text-accent fill-accent shrink-0" />
      ) : (
        <Database size={13} className="text-text-muted shrink-0" />
      )}
      <select
        value={activeSourceId ?? ""}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="appearance-none rounded-md border border-border-default bg-surface-raised pl-2 pr-6 py-1 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 cursor-pointer min-w-[160px]"
      >
        <option value="" disabled>
          {t("source.select")}
        </option>
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.id === defaultSourceId ? "\u2605 " : ""}{source.source_name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
}

function LanguageSelector() {
  const { t } = useTranslation("layout");
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const selectedLocale = normalizeLocale(user?.locale);

  useEffect(() => {
    void setActiveLocale(selectedLocale);
  }, [selectedLocale]);

  if (!user) return null;

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = normalizeLocale(event.target.value);
    if (nextLocale === selectedLocale) return;

    const previousLocale = selectedLocale;
    setSaving(true);
    setSaveFailed(false);
    updateUser({ ...user, locale: nextLocale });
    void setActiveLocale(nextLocale);

    try {
      const { data } = await apiClient.put<{ locale: string }>("/user/locale", {
        locale: nextLocale,
      });
      const savedLocale = normalizeLocale(data.locale);
      const latestUser = useAuthStore.getState().user;
      if (latestUser) {
        useAuthStore.getState().updateUser({ ...latestUser, locale: savedLocale });
      }
      void setActiveLocale(savedLocale);
    } catch {
      const latestUser = useAuthStore.getState().user;
      if (latestUser) {
        useAuthStore.getState().updateUser({ ...latestUser, locale: previousLocale });
      }
      void setActiveLocale(previousLocale);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="relative flex items-center gap-1.5"
      title={saveFailed ? t("language.saveFailed") : t("language.preferred")}
    >
      <Globe size={13} className="text-text-muted shrink-0" />
      <select
        value={selectedLocale}
        onChange={handleChange}
        disabled={saving}
        aria-label={t("language.preferred")}
        className="appearance-none rounded-md border border-border-default bg-surface-raised pl-2 pr-6 py-1 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-60 cursor-pointer min-w-[170px]"
      >
        {PUBLIC_SELECTABLE_LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.nativeLabel}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
}

export function Header() {
  const { user, isAuthenticated } = useAuthStore();
  const { setCommandPaletteOpen } = useUiStore();
  const togglePanel = useAbbyStore((s) => s.togglePanel);
  const { t } = useTranslation(["common", "layout"]);
  const [aboutAbbyOpen, setAboutAbbyOpen] = useState(false);

  useSourceInitializer();

  return (
    <header className="app-topbar">
      {/* Left: Command palette trigger */}
      <button
        className="search-bar"
        onClick={() => setCommandPaletteOpen(true)}
        style={{ maxWidth: 320, cursor: "pointer" }}
        data-tour="cmd-palette"
      >
        <Search size={16} className="search-icon" />
        <span style={{ color: "var(--text-ghost)", fontSize: "var(--text-base)" }}>
          {t("layout:header.searchPlaceholder")}
        </span>
        <span className="search-shortcut">{t("layout:header.searchShortcut")}</span>
      </button>

      {/* Center-right: CDM source selector */}
      {isAuthenticated && user && <HeaderSourceSelector />}

      {/* Right: actions */}
      <div className="topbar-actions">
        {isAuthenticated && user ? (
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setAboutAbbyOpen(true)}
              style={{
                color: "var(--accent)",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                gap: "var(--space-1)",
              }}
              aria-label={t("layout:header.aboutAbby")}
              title={t("layout:header.aboutAbby")}
            >
              {t("layout:header.aboutAbby")}
            </button>

            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={togglePanel}
              aria-label={t("layout:header.aiAssistant")}
              title={t("layout:header.aiAssistant")}
            >
              <AbbyAvatar size="sm" />
            </button>

            <AboutAbbyModal
              open={aboutAbbyOpen}
              onClose={() => setAboutAbbyOpen(false)}
            />

            <ThemeToggle />

            <LanguageSelector />

            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t("layout:header.notifications")}
              title={t("layout:header.notifications")}
            >
              <Bell size={18} />
            </button>

            <UserDropdown />
          </>
        ) : (
          <a href="/login" className="btn btn-primary btn-sm">
            {t("common:actions.login")}
          </a>
        )}
      </div>
    </header>
  );
}
