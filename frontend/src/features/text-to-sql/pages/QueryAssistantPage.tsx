import { useState } from "react";
import { MessageSquareCode, Database, Sparkles } from "lucide-react";
import { QueryLibraryTab } from "../components/QueryLibraryTab";
import { NaturalLanguageTab } from "../components/NaturalLanguageTab";

type Tab = "library" | "natural-language";

export default function QueryAssistantPage() {
  const [activeTab, setActiveTab] = useState<Tab>("library");

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            backgroundColor: "rgba(155, 27, 48, 0.18)",
            flexShrink: 0,
          }}
        >
          <MessageSquareCode size={22} style={{ color: "#9B1B30" }} />
        </div>
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#F0EDE8",
              margin: 0,
            }}
          >
            Query Assistant
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#8A857D",
              margin: "2px 0 0",
            }}
          >
            Browse the OHDSI query library or use AI to generate SQL from
            natural language
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          marginBottom: "24px",
          borderBottom: "1px solid #232328",
        }}
      >
        <TabButton
          active={activeTab === "library"}
          onClick={() => setActiveTab("library")}
          icon={<Database size={15} />}
          label="Query Library"
        />
        <TabButton
          active={activeTab === "natural-language"}
          onClick={() => setActiveTab("natural-language")}
          icon={<Sparkles size={15} />}
          label="Natural Language"
        />
      </div>

      {/* Tab content */}
      {activeTab === "library" ? <QueryLibraryTab /> : <NaturalLanguageTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 20px",
        background: "none",
        border: "none",
        borderBottom: `2px solid ${active ? "#9B1B30" : "transparent"}`,
        color: active ? "#F0EDE8" : "#8A857D",
        fontSize: "14px",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 150ms",
        marginBottom: "-1px",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = "#C5C0B8";
          e.currentTarget.style.borderBottomColor = "#333";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = "#8A857D";
          e.currentTarget.style.borderBottomColor = "transparent";
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
}
