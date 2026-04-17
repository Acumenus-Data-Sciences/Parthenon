import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Joyride, STATUS, type Step } from "react-joyride";
import { BookOpen, Database, FlaskConical, X, ArrowRight, Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/models";
import { cn } from "@/lib/utils";

const TOUR_STEP_DEFS = [
  {
    target: "[data-tour='sidebar']",
    titleKey: "setup.onboarding.tour.sidebarTitle",
    contentKey: "setup.onboarding.tour.sidebarContent",
    skipBeacon: true,
    placement: "right",
  },
  {
    target: "[data-tour='cmd-palette']",
    titleKey: "setup.onboarding.tour.commandTitle",
    contentKey: "setup.onboarding.tour.commandContent",
    placement: "bottom",
  },
  {
    target: "[data-tour='data-sources']",
    titleKey: "setup.onboarding.tour.dataSourcesTitle",
    contentKey: "setup.onboarding.tour.dataSourcesContent",
    placement: "right",
  },
  {
    target: "[data-tour='cohort-definitions']",
    titleKey: "setup.onboarding.tour.cohortDefinitionsTitle",
    contentKey: "setup.onboarding.tour.cohortDefinitionsContent",
    placement: "right",
  },
  {
    target: "[data-tour='vocabulary']",
    titleKey: "setup.onboarding.tour.vocabularyTitle",
    contentKey: "setup.onboarding.tour.vocabularyContent",
    placement: "right",
  },
] as const;

const ACTION_CARD_DEFS = [
  {
    icon: Database,
    titleKey: "setup.onboarding.cards.vocabularyTitle",
    descriptionKey: "setup.onboarding.cards.vocabularyDescription",
    href: "/vocabulary",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: FlaskConical,
    titleKey: "setup.onboarding.cards.cohortTitle",
    descriptionKey: "setup.onboarding.cards.cohortDescription",
    href: "/cohort-definitions",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: BookOpen,
    titleKey: "setup.onboarding.cards.quickStartTitle",
    descriptionKey: "setup.onboarding.cards.quickStartDescription",
    href: "/data-explorer",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
] as const;

export function OnboardingModal() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const updateUser = useAuthStore((s) => s.updateUser);

  const [runTour, setRunTour] = useState(false);
  const [completing, setCompleting] = useState(false);

  const tourSteps = useMemo<Step[]>(
    () =>
      TOUR_STEP_DEFS.map(({ titleKey, contentKey, ...step }) => ({
        ...step,
        title: t(titleKey),
        content: t(contentKey),
      })),
    [t],
  );

  const actionCards = useMemo(
    () =>
      ACTION_CARD_DEFS.map((card) => ({
        ...card,
        title: t(card.titleKey),
        description: t(card.descriptionKey),
      })),
    [t],
  );

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
        steps={tourSteps}
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
              aria-label={t("setup.onboarding.skipAria")}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-text-primary">
                {t("setup.onboarding.title")}
              </h1>
              <p className="mt-2 text-sm text-text-muted">
                {t("setup.onboarding.intro")}
              </p>
            </div>

            {/* Action cards */}
            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {actionCards.map((card) => {
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
                  "hover:bg-accent-light transition-colors disabled:opacity-50",
                )}
              >
                {completing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <>
                    {t("setup.onboarding.startTour")}
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
                {t("setup.onboarding.skip")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
