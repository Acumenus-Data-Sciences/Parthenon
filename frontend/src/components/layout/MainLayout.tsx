import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { AbbyPanel } from "./AbbyPanel";
import { ToastContainer } from "@/components/ui";
import { ChangePasswordModal } from "@/features/auth/components/ChangePasswordModal";
import { OnboardingModal } from "@/features/auth/components/OnboardingModal";
import { SetupWizard } from "@/features/auth/components/SetupWizard";
import { AtlasMigrationWizard } from "@/features/administration/components/AtlasMigrationWizard";
import { WhatsNewModal } from "@/features/help";
import { SetupWizardContext } from "@/contexts/SetupWizardContext";
import { AtlasMigrationContext } from "@/contexts/AtlasMigrationContext";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => (s.user?.roles ?? []).includes("super-admin"));

  // Wizard open state — true on first launch, togglable from admin panel
  const [wizardOpen, setWizardOpen] = useState(
    () => !!user && !user.onboarding_completed && isSuperAdmin,
  );

  // Atlas migration wizard — opened from admin dashboard
  const [atlasMigrationOpen, setAtlasMigrationOpen] = useState(false);

  // Register global keyboard shortcuts
  useGlobalKeyboard();

  const showWizard = wizardOpen && isSuperAdmin;

  return (
    <SetupWizardContext.Provider value={{ openSetupWizard: () => setWizardOpen(true) }}>
    <AtlasMigrationContext.Provider value={{ openAtlasMigration: () => setAtlasMigrationOpen(true) }}>
      <div className="app-shell">
        {/* Blocking password change for non-superadmins (superadmins handle it inside the wizard) */}
        {user?.must_change_password && !isSuperAdmin && <ChangePasswordModal />}

        {/* Superadmin setup wizard — first launch or opened from admin panel */}
        {showWizard && (
          <SetupWizard
            mustChangePassword={user?.must_change_password ?? false}
            onClose={user?.onboarding_completed ? () => setWizardOpen(false) : undefined}
          />
        )}

        {/* Regular user onboarding tour — shown after password change if needed */}
        {user && !user.onboarding_completed && !isSuperAdmin && !user.must_change_password && (
          <OnboardingModal />
        )}

        <Sidebar />
        <div className={cn("app-content", !sidebarOpen && "sidebar-collapsed")}>
          <Header />
          <main className="content-main">
            <Outlet />
          </main>
        </div>
        <CommandPalette />
        <AbbyPanel />
        <ToastContainer />
        <WhatsNewModal />

        {/* Atlas migration wizard — in-window modal, same pattern as SetupWizard */}
        {atlasMigrationOpen && (
          <AtlasMigrationWizard onClose={() => setAtlasMigrationOpen(false)} />
        )}
      </div>
    </AtlasMigrationContext.Provider>
    </SetupWizardContext.Provider>
  );
}
