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
  const femalePctDisplay = Math.round(profile.female_pct * 100);

  if (compact) {
    const topThree = profile.top_conditions
      .slice(0, 3)
      .map((c) => c.name)
      .join(", ");

    return (
      <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3">
        <p className="text-sm text-text-secondary">
          <span className="font-['IBM_Plex_Mono',monospace] text-text-primary">
            {profile.patient_count.toLocaleString()}
          </span>{" "}
          patients &bull; Age {profile.min_age}&ndash;{profile.max_age} &bull;{" "}
          {femalePctDisplay}% female
        </p>
        {topThree && (
          <p className="mt-1 text-xs text-text-ghost">{topThree}</p>
        )}
      </div>
    );
  }

  const conditionEntries = profile.top_conditions.slice(0, 5);
  const measurementEntries = Object.entries(profile.measurement_coverage);

  return (
    <div className="space-y-6 rounded-xl border border-border-default bg-surface-raised p-6">
      {/* Demographics */}
      <div>
        <SectionHeader>Demographics</SectionHeader>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className="font-['IBM_Plex_Mono',monospace] text-2xl text-text-primary">
              {profile.patient_count.toLocaleString()}
            </span>
            <span className="ml-2 text-xs text-text-ghost">patients</span>
          </div>
          <div className="text-sm text-text-secondary">
            Age{" "}
            <span className="font-['IBM_Plex_Mono',monospace]">
              {profile.min_age}
            </span>
            &ndash;
            <span className="font-['IBM_Plex_Mono',monospace]">
              {profile.max_age}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              {femalePctDisplay}% female
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

      {/* Top Conditions */}
      {conditionEntries.length > 0 && (
        <div>
          <SectionHeader>Top Conditions</SectionHeader>
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

      {/* Measurement Coverage */}
      {measurementEntries.length > 0 && (
        <div>
          <SectionHeader>Measurement Coverage</SectionHeader>
          <div className="space-y-3">
            {measurementEntries.map(([conceptId, coverage]) => (
              <PercentageBar
                key={conceptId}
                label={conceptId}
                value={coverage}
                color="#F59E0B"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
