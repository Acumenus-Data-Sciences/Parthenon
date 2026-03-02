import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { LogOut, User, Search, Sparkles, Bell } from "lucide-react";

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { setCommandPaletteOpen, toggleAiDrawer } = useUiStore();

  return (
    <header className="app-topbar">
      {/* Left: Command palette trigger */}
      <button
        className="search-bar"
        onClick={() => setCommandPaletteOpen(true)}
        style={{ maxWidth: 320, cursor: "pointer" }}
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
              className="btn btn-ghost btn-icon btn-sm"
              onClick={toggleAiDrawer}
              aria-label="AI Assistant"
              title="AI Assistant"
            >
              <Sparkles size={18} />
            </button>

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
