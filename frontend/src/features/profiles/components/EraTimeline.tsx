import { Link } from "react-router-dom";
import type { ConditionEra, DrugEra } from "../types/profile";

interface EraTimelineProps {
  conditionEras: ConditionEra[];
  drugEras: DrugEra[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EraBar({
  startDate,
  endDate,
  minDate,
  maxDate,
  color,
}: {
  startDate: string;
  endDate: string;
  minDate: number;
  maxDate: number;
  color: string;
}) {
  const range = maxDate - minDate || 1;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const left = ((start - minDate) / range) * 100;
  const width = Math.max(((end - start) / range) * 100, 0.5);

  return (
    <div
      className="absolute top-0 h-full rounded-sm"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        backgroundColor: color,
        opacity: 0.7,
      }}
    />
  );
}

export function EraTimeline({ conditionEras, drugEras }: EraTimelineProps) {
  const allDates = [
    ...conditionEras.flatMap((e) => [
      new Date(e.condition_era_start_date).getTime(),
      new Date(e.condition_era_end_date).getTime(),
    ]),
    ...drugEras.flatMap((e) => [
      new Date(e.drug_era_start_date).getTime(),
      new Date(e.drug_era_end_date).getTime(),
    ]),
  ];

  if (allDates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-highlight bg-surface-raised p-6 text-center">
        <p className="text-xs text-text-muted">No era data available</p>
      </div>
    );
  }

  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);

  return (
    <div className="space-y-4">
      {/* Condition Eras */}
      {conditionEras.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-critical mb-2 uppercase tracking-wider">
            Condition Eras ({conditionEras.length})
          </h4>
          <div className="space-y-1">
            {conditionEras.map((era) => (
              <div
                key={era.condition_era_id}
                className="flex items-center gap-3 group"
              >
                <div className="w-48 shrink-0 truncate">
                  <Link
                    to={`/vocabulary?concept=${era.condition_concept_id}`}
                    className="text-xs text-text-primary hover:text-accent transition-colors"
                  >
                    {era.condition_name}
                  </Link>
                </div>
                <div className="flex-1 relative h-4 rounded bg-surface-overlay border border-border-default">
                  <EraBar
                    startDate={era.condition_era_start_date}
                    endDate={era.condition_era_end_date}
                    minDate={minDate}
                    maxDate={maxDate}
                    color="var(--critical)"
                  />
                </div>
                <div className="w-28 shrink-0 text-right">
                  <span className="text-[10px] text-text-muted">
                    {formatDate(era.condition_era_start_date)} -{" "}
                    {formatDate(era.condition_era_end_date)}
                  </span>
                </div>
                <div className="w-12 shrink-0 text-right">
                  <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-text-ghost">
                    x{era.condition_occurrence_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drug Eras */}
      {drugEras.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-success mb-2 uppercase tracking-wider">
            Drug Eras ({drugEras.length})
          </h4>
          <div className="space-y-1">
            {drugEras.map((era) => (
              <div
                key={era.drug_era_id}
                className="flex items-center gap-3 group"
              >
                <div className="w-48 shrink-0 truncate">
                  <Link
                    to={`/vocabulary?concept=${era.drug_concept_id}`}
                    className="text-xs text-text-primary hover:text-accent transition-colors"
                  >
                    {era.drug_name}
                  </Link>
                </div>
                <div className="flex-1 relative h-4 rounded bg-surface-overlay border border-border-default">
                  <EraBar
                    startDate={era.drug_era_start_date}
                    endDate={era.drug_era_end_date}
                    minDate={minDate}
                    maxDate={maxDate}
                    color="var(--success)"
                  />
                </div>
                <div className="w-28 shrink-0 text-right">
                  <span className="text-[10px] text-text-muted">
                    {formatDate(era.drug_era_start_date)} -{" "}
                    {formatDate(era.drug_era_end_date)}
                  </span>
                </div>
                <div className="w-12 shrink-0 text-right">
                  <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-text-ghost">
                    x{era.drug_exposure_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
