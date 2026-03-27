import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { useAbbyStore } from "@/stores/abbyStore";
import { LogOut, User, Search, Sparkles, Bell, Settings, ChevronDown, Database, Star } from "lucide-react";
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

  const avatarUrl = user?.avatar ? `/storage/${user.avatar}` : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="btn btn-ghost btn-sm"
        style={{ gap: "var(--space-1)" }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.name ?? ""}
            className="w-6 h-6 rounded-full object-cover"
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
          className="absolute right-0 mt-1 w-48 rounded-lg border border-[#232328] bg-[#151518] shadow-xl z-50 py-1"
        >
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#C5C0B8] hover:bg-[#1A1A1F] transition-colors"
          >
            <Settings size={14} />
            Settings
          </button>
          <div className="border-t border-[#232328] my-1" />
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#E85A6B] hover:bg-[#1A1A1F] transition-colors"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function GlobalSourceSelector() {
  const { activeSourceId, setActiveSource, setSources, setDefaultSourceId } = useSourceStore();
  const { data: sources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  useEffect(() => {
    if (!sources?.length) return;
    setSources(sources.map((s: Source) => ({ id: s.id, source_name: s.source_name, is_default: s.is_default })));
    const defaultSrc = sources.find((s: Source) => s.is_default);
    if (defaultSrc) setDefaultSourceId(defaultSrc.id);
    if (!activeSourceId) {
      setActiveSource(defaultSrc ? defaultSrc.id : sources[0].id);
    }
  }, [sources, activeSourceId, setActiveSource, setSources, setDefaultSourceId]);

  const selected = sources?.find((s: Source) => s.id === activeSourceId);

  return (
    <div className="flex items-center gap-1.5">
      {selected?.is_default ? (
        <Star size={12} className="text-[#C9A227] fill-[#C9A227]" />
      ) : (
        <Database size={12} className="text-[#8A857D]" />
      )}
      <select
        value={activeSourceId ?? ""}
        onChange={(e) => setActiveSource(Number(e.target.value))}
        className="appearance-none rounded border border-[#232328] bg-[#0E0E11] pl-2 pr-6 py-1 text-xs text-[#C5C0B8] focus:border-[#C9A227] focus:outline-none cursor-pointer min-w-[140px]"
      >
        <option value="" disabled>Select source</option>
        {sources?.map((s: Source) => (
          <option key={s.id} value={s.id}>
            {s.is_default ? "\u2605 " : ""}{s.source_name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Header() {
  const { user, isAuthenticated } = useAuthStore();
  const { setCommandPaletteOpen } = useUiStore();
  const togglePanel = useAbbyStore((s) => s.togglePanel);
  const [aboutAbbyOpen, setAboutAbbyOpen] = useState(false);

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

      {/* Right: actions */}
      <div className="topbar-actions">
        {isAuthenticated && user ? (
          <>
            <GlobalSourceSelector />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setAboutAbbyOpen(true)}
              style={{
                color: "#C9A227",
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
              <Sparkles size={18} />
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
