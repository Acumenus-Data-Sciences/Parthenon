import { ChevronRight, Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDeletePin, useEvidencePins } from "../hooks/useEvidencePins";
import { useInvestigationStore } from "../stores/investigationStore";
import type { PinSection } from "../types";
import { PinCard } from "./PinCard";
import { getInvestigationSectionLabel } from "../lib/i18n";

interface EvidenceSidebarProps {
  investigationId: number;
}

export function EvidenceSidebar({ investigationId }: EvidenceSidebarProps) {
  const { t } = useTranslation("app");
  const { sidebarOpen, toggleSidebar } = useInvestigationStore();
  const { data: pins, isLoading, isError, refetch } = useEvidencePins(investigationId);
  const deletePin = useDeletePin(investigationId);

  const pinCount = pins?.length ?? 0;

  // Group pins by section
  const grouped = (pins ?? []).reduce<Partial<Record<PinSection, typeof pins>>>(
    (acc, pin) => {
      const section = pin.section;
      if (!acc[section]) acc[section] = [];
      acc[section]!.push(pin);
      return acc;
    },
    {},
  );

  const sections = Object.keys(grouped) as PinSection[];

  return (
    <div
      className={[
        "flex flex-col border-l border-border-default transition-all duration-200 overflow-hidden shrink-0",
        sidebarOpen ? "w-72" : "w-8",
      ].join(" ")}
      style={{ backgroundColor: "var(--surface-base)" }}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-border-default">
        {sidebarOpen && (
          <span className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("investigation.common.sections.evidence")}
          </span>
        )}
        {/* Collapsed: show pin count badge when there are pins */}
        {!sidebarOpen && pinCount > 0 && (
          <div className="flex flex-col items-center gap-1 w-full mb-1">
            <Pin size={12} className="text-success" />
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success/10 text-success text-[10px] font-semibold">
              {pinCount > 99 ? "99+" : pinCount}
            </span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="text-text-ghost hover:text-text-secondary transition-colors ml-auto"
          aria-label={
            sidebarOpen
              ? t("layout.sidebar.collapse")
              : t("layout.sidebar.expand")
          }
        >
          <ChevronRight
            size={16}
            className={`transition-transform ${sidebarOpen ? "rotate-0" : "rotate-180"}`}
          />
        </button>
      </div>

      {sidebarOpen && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
          {/* Loading state */}
          {isLoading && (
            <div
              className="flex flex-col gap-3 mt-2"
              aria-label={t("investigation.common.messages.loadingPins")}
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded bg-surface-raised/60 h-12 w-full" />
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center gap-2 mt-6 px-1">
              <p className="text-xs text-text-ghost text-center">
                {t("investigation.common.messages.searchFailed")}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="text-xs text-success hover:underline transition-colors"
              >
                {t("investigation.common.actions.retry")}
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && sections.length === 0 && (
            <p className="text-xs text-text-ghost text-center mt-8">
              {t("investigation.common.empty.noPinsYet")}
            </p>
          )}

          {/* Pin sections */}
          {!isLoading && !isError && sections.map((section) => {
            const sectionPins = grouped[section] ?? [];
            return (
              <div key={section}>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-ghost mb-2">
                  {getInvestigationSectionLabel(t, section)}
                </p>
                <div className="flex flex-col gap-1.5">
                  {sectionPins.map((pin) => (
                    <PinCard
                      key={pin.id}
                      pin={pin}
                      onDelete={(id) => deletePin.mutate(id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
