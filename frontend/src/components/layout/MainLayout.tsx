import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { AiDrawer } from "./AiDrawer";
import { ToastContainer } from "@/components/ui";
import { useUiStore } from "@/stores/uiStore";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  // Register global keyboard shortcuts
  useGlobalKeyboard();

  return (
    <div className="app-shell">
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
