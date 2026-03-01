import { useAuthStore } from "@/stores/authStore";
import { LogOut, User } from "lucide-react";

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div />
      <div className="flex items-center gap-4">
        {isAuthenticated && user ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User size={16} />
              <span>{user.name}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <a
            href="/login"
            className="text-sm text-primary hover:text-primary/80"
          >
            Login
          </a>
        )}
      </div>
    </header>
  );
}
