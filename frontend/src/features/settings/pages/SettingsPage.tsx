import { useSearchParams } from "react-router-dom";
import { User, Shield, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileTab } from "../components/ProfileTab";
import { AccountSecurityTab } from "../components/AccountSecurityTab";
import { NotificationSettings } from "../components/NotificationSettings";

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "account", label: "Account & Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) || "profile";

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#2DD4BF]/10">
          <Settings size={20} className="text-[#2DD4BF]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Settings</h1>
          <p className="text-sm text-[#8A857D]">
            Manage your profile, security, and preferences
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#232328]">
        <nav className="flex gap-1" role="tablist">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => handleTabChange(key)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === key
                  ? "border-[#2DD4BF] text-[#2DD4BF]"
                  : "border-transparent text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#232328]",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-2">
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "account" && <AccountSecurityTab />}
        {activeTab === "notifications" && <NotificationSettings />}
      </div>
    </div>
  );
}
