import { useTranslation } from "react-i18next";

interface CohortProfilePanelProps {
  profile: {
    patient_count: number;
    min_age: number;
    max_age: number;
    female_pct: number;
    top_conditions: Array<{
      concept_id: number;
      name: string;
      prevalence: number;
    }>;
    measurement_coverage: Record<string, number>;
  };
  compact?: boolean;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-[10px] uppercase tracking-wider text-text-ghost">
      {children}
    </h4>
  );
}

function PercentageBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-elevated">
        <div
          className="h-2 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function CohortProfilePanel({
  profile,
  compact = false,
}: CohortProfilePanelProps) {
  const { t } = useTranslation("app");
  const bullet = String.fromCharCode(8226);
  const enDash = String.fromCharCode(8211);
  const femalePctDisplay = Math.round(profile.female_pct * 100);

  if (compact) {
    const topThree = profile.top_conditions
      .slice(0, 3)
      .map((condition) => condition.name)
      .join(", ");

    return (
      <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3">
        <p className="text-sm text-text-secondary">
          <span className="font-['IBM_Plex_Mono',monospace] text-text-primary">
            {profile.patient_count.toLocaleString()}
          </span>{" "}
          {t("riskScores.cohortProfile.patients")} {bullet}{" "}
          {t("riskScores.cohortProfile.age")} {profile.min_age}
          {enDash}
          {profile.max_age} {bullet}{" "}
          {t("riskScores.cohortProfile.female", { count: femalePctDisplay })}
        </p>
        {topThree && <p className="mt-1 text-xs text-text-ghost">{topThree}</p>}
      </div>
    );
  }

  const conditionEntries = profile.top_conditions.slice(0, 5);
  const measurementEntries = Object.entries(profile.measurement_coverage);

  return (
    <div className="space-y-6 rounded-xl border border-border-default bg-surface-raised p-6">
      <div>
        <SectionHeader>{t("riskScores.cohortProfile.demographics")}</SectionHeader>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className="font-['IBM_Plex_Mono',monospace] text-2xl text-text-primary">
              {profile.patient_count.toLocaleString()}
            </span>
            <span className="ml-2 text-xs text-text-ghost">
              {t("riskScores.cohortProfile.patients")}
            </span>
          </div>
          <div className="text-sm text-text-secondary">
            {t("riskScores.cohortProfile.age")}{" "}
            <span className="font-['IBM_Plex_Mono',monospace]">
              {profile.min_age}
            </span>
            {enDash}
            <span className="font-['IBM_Plex_Mono',monospace]">
              {profile.max_age}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              {t("riskScores.cohortProfile.female", { count: femalePctDisplay })}
            </span>
            <div className="h-2 w-20 rounded-full bg-surface-elevated">
              <div
                className="h-2 rounded-full bg-success"
                style={{ width: `${femalePctDisplay}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {conditionEntries.length > 0 && (
        <div>
          <SectionHeader>{t("riskScores.cohortProfile.topConditions")}</SectionHeader>
          <div className="space-y-3">
            {conditionEntries.map((condition) => (
              <PercentageBar
                key={condition.concept_id}
                label={condition.name}
                value={condition.prevalence}
                color="var(--success)"
              />
            ))}
          </div>
        </div>
      )}

      {measurementEntries.length > 0 && (
        <div>
          <SectionHeader>
            {t("riskScores.cohortProfile.measurementCoverage")}
          </SectionHeader>
          <div className="space-y-3">
            {measurementEntries.map(([conceptId, coverage]) => (
              <PercentageBar
                key={conceptId}
                label={conceptId}
                value={coverage}
                color="var(--warning)"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
