import { useTranslation } from "react-i18next";
import { useAbbyProfile } from '../hooks/useAbbyProfile';
import { getAbbyVerbosityLabel } from "../lib/i18n";

export function AbbyProfilePanel() {
  const { t } = useTranslation("app");
  const { profile, isLoading, error, resetProfile } = useAbbyProfile();

  if (isLoading) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        {t("abbyLegacy.profile.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-400 text-sm">
        {t("abbyLegacy.profile.failed")}
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="border-t border-border/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          {t("abbyLegacy.profile.title")}
        </h3>
        <button
          type="button"
          onClick={() => resetProfile()}
          className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
        >
          {t("abbyLegacy.profile.reset")}
        </button>
      </div>

      {profile.research_interests.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            {t("abbyLegacy.profile.researchInterests")}
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.research_interests.map((interest) => (
              <span
                key={interest}
                className="px-2 py-0.5 text-xs rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(profile.expertise_domains).length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            {t("abbyLegacy.profile.expertise")}
          </p>
          <div className="space-y-1">
            {Object.entries(profile.expertise_domains).map(([domain, level]) => (
              <div key={domain} className="flex items-center gap-2">
                <span className="text-xs text-foreground/80 w-24 truncate">{domain}</span>
                <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all"
                    style={{ width: `${(level as number) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.interaction_preferences.verbosity && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            {t("abbyLegacy.profile.responseStyle")}
          </p>
          <span className="text-xs text-foreground/80">
            {getAbbyVerbosityLabel(
              t,
              profile.interaction_preferences.verbosity,
            )}
          </span>
        </div>
      )}

      {profile.research_interests.length === 0 &&
       Object.keys(profile.expertise_domains).length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          {t("abbyLegacy.profile.learningMessage")}
        </p>
      )}
    </div>
  );
}
