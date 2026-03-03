import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { AiDrawer } from "./AiDrawer";
import { ToastContainer } from "@/components/ui";
import { ChangePasswordModal } from "@/features/auth/components/ChangePasswordModal";
import { OnboardingModal } from "@/features/auth/components/OnboardingModal";
import { SetupWizard } from "@/features/auth/components/SetupWizard";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => (s.user?.roles ?? []).includes("super-admin"));

  // Register global keyboard shortcuts
  useGlobalKeyboard();

  return (
    <div className="app-shell">
      {/* Blocking modal: shown until user changes their temporary password */}
      {user?.must_change_password && <ChangePasswordModal />}

      {/* Onboarding: superadmins see the setup wizard, others see the quick tour */}
      {user && !user.must_change_password && !user.onboarding_completed && (
        isSuperAdmin ? <SetupWizard /> : <OnboardingModal />
      )}

      <Sidebar />
      <div className={cn("app-content", !sidebarOpen && "sidebar-collapsed")}>
        <Header />
        <main className="content-main">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <AiDrawer />
      <ToastContainer />
    </div>
  );
}
