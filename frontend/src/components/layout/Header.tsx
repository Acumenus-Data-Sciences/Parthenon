import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { useAbbyStore } from "@/stores/abbyStore";
import { LogOut, User, Search, Bell, Settings, ChevronDown, Database, Star } from "lucide-react";
import AbbyAvatar from "@/features/commons/components/abby/AbbyAvatar";
import { AboutAbbyModal } from "./AboutAbbyModal";
import { useSourceStore } from "@/stores/sourceStore";
import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type { Source } from "@/types/models";

function UserDropdown() {
  const { user, logout } = useAuthStore();
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
            Settings
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
            Logout
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
        <Star size={13} className="text-accent fill-[#C9A227] shrink-0" />
      ) : (
        <Database size={13} className="text-text-muted shrink-0" />
      )}
      <select
        value={activeSourceId ?? ""}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="appearance-none rounded-md border border-border-default bg-surface-raised pl-2 pr-6 py-1 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30 cursor-pointer min-w-[160px]"
      >
        <option value="" disabled>
          Select source
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

export function Header() {
  const { user, isAuthenticated } = useAuthStore();
  const { setCommandPaletteOpen } = useUiStore();
  const togglePanel = useAbbyStore((s) => s.togglePanel);
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
          Search or jump to...
        </span>
        <span className="search-shortcut">Ctrl K</span>
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
              aria-label="About Abby"
              title="About Abby"
            >
              About Abby
            </button>

            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={togglePanel}
              aria-label="AI Assistant"
              title="AI Assistant"
            >
              <AbbyAvatar size="sm" />
            </button>

            <AboutAbbyModal
              open={aboutAbbyOpen}
              onClose={() => setAboutAbbyOpen(false)}
            />

            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={18} />
            </button>

            <UserDropdown />
          </>
        ) : (
          <a href="/login" className="btn btn-primary btn-sm">
            Login
          </a>
        )}
      </div>
    </header>
  );
}
