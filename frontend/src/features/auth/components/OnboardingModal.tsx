import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Joyride, STATUS, type Step } from "react-joyride";
import { BookOpen, Database, FlaskConical, X, ArrowRight, Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/models";
import { cn } from "@/lib/utils";

const TOUR_STEPS: Step[] = [
  {
    target: "[data-tour='sidebar']",
    title: "Navigation Sidebar",
    content:
      "All your research tools live here: Data Explorer, Vocabulary, Cohort Definitions, Concept Sets, Analyses, and more.",
    skipBeacon: true,
    placement: "right",
  },
  {
    target: "[data-tour='cmd-palette']",
    title: "Command Palette (⌘K)",
    content:
      "Quickly jump to any page or action without clicking through menus. Try ⌘K (or Ctrl+K) and search 'cohort'.",
    placement: "bottom",
  },
  {
    target: "[data-tour='data-sources']",
    title: "Data Sources",
    content:
      "Connect your CDM sources here. All analyses run against these data sources.",
    placement: "right",
  },
  {
    target: "[data-tour='cohort-definitions']",
    title: "Cohort Definitions",
    content:
      "Build OHDSI-compatible cohort definitions using inclusion/exclusion criteria, then generate counts against any connected CDM.",
    placement: "right",
  },
  {
    target: "[data-tour='vocabulary']",
    title: "Vocabulary Explorer",
    content:
      "Search 7M+ OMOP concepts, browse hierarchies, and build concept sets to use in your cohort definitions.",
    placement: "right",
  },
];

const ACTION_CARDS = [
  {
    icon: Database,
    title: "Explore Vocabulary",
    description: "Search 7M+ OMOP concepts and build concept sets.",
    href: "/vocabulary",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: FlaskConical,
    title: "Build a Cohort",
    description: "Define inclusion/exclusion criteria and generate counts.",
    href: "/cohort-definitions",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: BookOpen,
    title: "Read the Quick Start",
    description: "From zero to a cohort count in 15 minutes.",
    href: "/data-explorer",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

export function OnboardingModal() {
  const navigate = useNavigate();
  const updateUser = useAuthStore((s) => s.updateUser);

  const [runTour, setRunTour] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function markComplete() {
    if (completing) return;
    setCompleting(true);
    try {
      await apiClient.put<{ onboarding_completed: boolean }>("/user/onboarding");
      // Optimistically update the auth store so the modal unmounts
      const { data } = await apiClient.get<{ data: User }>("/auth/user");
      updateUser(data.data ?? (data as unknown as User));
    } catch {
      // Fallback: patch local state even if API call failed
      const user = useAuthStore.getState().user;
      if (user) updateUser({ ...user, onboarding_completed: true });
    } finally {
      setCompleting(false);
    }
  }

  async function startTour() {
    setRunTour(true);
    await markComplete();
  }

  async function handleCardClick(href: string) {
    await markComplete();
    navigate(href);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleJoyrideEvent(data: any) {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
    }
  }

  return (
    <>
      {/* Joyride tour (runs over the app, not the overlay) */}
      <Joyride
        steps={TOUR_STEPS}
        run={runTour}
        continuous
        onEvent={handleJoyrideEvent}
        options={{
          buttons: ["back", "close", "primary", "skip"],
          showProgress: true,
          primaryColor: "var(--accent)",
          backgroundColor: "var(--surface-overlay)",
          textColor: "var(--text-secondary)",
          overlayColor: "rgba(0,0,0,0.65)",
          zIndex: 10000,
        }}
        styles={{
          buttonPrimary: {
            backgroundColor: "var(--accent)",
            color: "var(--surface-base)",
          },
          buttonBack: {
            color: "var(--text-muted)",
          },
          buttonSkip: {
            color: "var(--text-muted)",
          },
        }}
      />

      {/* Full-screen welcome overlay — only shown if tour not running */}
      {!runTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/90 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-2xl rounded-2xl border border-border-default bg-surface-raised p-8 shadow-2xl">
            {/* Skip button */}
            <button
              type="button"
              onClick={markComplete}
              disabled={completing}
              className="absolute right-4 top-4 rounded-md p-1.5 text-text-ghost hover:text-text-muted transition-colors"
              aria-label="Skip onboarding"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-text-primary">
                Welcome to Parthenon
              </h1>
              <p className="mt-2 text-sm text-text-muted">
                A modern OMOP outcomes research platform. Let's get you started.
              </p>
            </div>

            {/* Action cards */}
            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ACTION_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.href}
                    type="button"
                    onClick={() => handleCardClick(card.href)}
                    className={cn(
                      "group flex flex-col items-start rounded-xl border border-border-default bg-surface-overlay p-4",
                      "hover:border-surface-highlight hover:bg-surface-overlay transition-colors text-left",
                    )}
                  >
                    <div className={cn("mb-3 rounded-lg p-2", card.bg)}>
                      <Icon size={18} className={card.color} />
                    </div>
                    <p className="text-sm font-semibold text-text-primary">{card.title}</p>
                    <p className="mt-1 text-xs text-text-muted">{card.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Tour CTA */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={startTour}
                disabled={completing}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-surface-base",
                  "hover:bg-accent transition-colors disabled:opacity-50",
                )}
              >
                {completing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <>
                    Start Quick Tour
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={markComplete}
                disabled={completing}
                className="text-xs text-text-ghost hover:text-text-muted transition-colors"
              >
                I'm already familiar — skip
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
