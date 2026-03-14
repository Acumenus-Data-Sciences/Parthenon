import { useState } from "react";
import { Zap, Pin, FileText } from "lucide-react";

const TABS = [
  { key: "activity", label: "Activity", icon: Zap, placeholder: "Activity Feed" },
  { key: "pinned", label: "Pinned", icon: Pin, placeholder: "Pinned Messages" },
  { key: "files", label: "Files", icon: FileText, placeholder: "Shared Files" },
] as const;

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<string>("activity");
  const active = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="flex w-[280px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
        <active.icon className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-[13px] font-medium text-muted-foreground">{active.placeholder}</p>
        <p className="text-xs text-muted-foreground/60">Coming in a future update</p>
      </div>
    </div>
  );
}
