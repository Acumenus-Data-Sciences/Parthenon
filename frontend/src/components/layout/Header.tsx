import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { useAbbyStore } from "@/stores/abbyStore";
import { LogOut, User, Search, Sparkles, Bell } from "lucide-react";
import { AboutAbbyModal } from "./AboutAbbyModal";

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
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

            <div className="flex items-center gap-2 px-2" style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
              <User size={16} />
              <span>{user.name}</span>
            </div>

            <button
              onClick={logout}
              className="btn btn-ghost btn-sm"
              style={{ gap: "var(--space-1)" }}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
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
