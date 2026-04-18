import { useTranslation } from "react-i18next";
import type { ReleaseCalendarEvent } from "../../../types/ares";

interface ReleaseCalendarProps {
  events: ReleaseCalendarEvent[];
}

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-surface-overlay";
  if (count === 1) return "bg-success/20";
  if (count <= 3) return "bg-success/40";
  return "bg-success/70";
}

export default function ReleaseCalendar({ events }: ReleaseCalendarProps) {
  const { t } = useTranslation("app");

  if (events.length === 0) {
    return (
      <p className="text-center text-xs text-text-ghost">
        {t("dataExplorer.ares.releases.calendar.noEvents")}
      </p>
    );
  }

  // Group events by date
  const byDate = new Map<string, ReleaseCalendarEvent[]>();
  for (const evt of events) {
    const existing = byDate.get(evt.date) ?? [];
    existing.push(evt);
    byDate.set(evt.date, existing);
  }

  // Build 12-month calendar grid
  const allDates = events.map((e) => new Date(e.date));
  const latestDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  const startMonth = new Date(latestDate);
  startMonth.setMonth(startMonth.getMonth() - 11);
  startMonth.setDate(1);

  const months: Array<{ label: string; weeks: Array<Array<{ date: string; count: number }>> }> = [];

  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(startMonth);
    monthDate.setMonth(monthDate.getMonth() + m);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const label = monthDate.toLocaleString("default", { month: "short" });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks: Array<Array<{ date: string; count: number }>> = [[]];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month, d);
      const dateStr = dayDate.toISOString().split("T")[0];
      const dayOfWeek = dayDate.getDay();

      if (dayOfWeek === 0 && weeks[weeks.length - 1].length > 0) {
        weeks.push([]);
      }

      weeks[weeks.length - 1].push({
        date: dateStr,
        count: byDate.get(dateStr)?.length ?? 0,
      });
    }

    months.push({ label, weeks });
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {months.map((month) => (
          <div key={month.label} className="shrink-0">
            <div className="mb-1 text-center text-[9px] text-text-ghost">{month.label}</div>
            <div className="space-y-0.5">
              {month.weeks.map((week, wi) => (
                <div key={wi} className="flex gap-0.5">
                  {week.map((day) => (
                    <div
                      key={day.date}
                      className={`group relative h-3 w-3 rounded-sm ${getIntensityClass(day.count)}`}
                    >
                      {day.count > 0 && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-surface-base px-2 py-1 text-[9px] text-text-secondary opacity-0 shadow-lg group-hover:opacity-100 transition-opacity border border-border-subtle">
                          {t("dataExplorer.ares.releases.calendar.dayEvents", {
                            date: day.date,
                            count: day.count,
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[9px] text-text-ghost">
        <span>{t("dataExplorer.ares.releases.calendar.less")}</span>
        <span className="h-3 w-3 rounded-sm bg-surface-overlay" />
        <span className="h-3 w-3 rounded-sm bg-success/20" />
        <span className="h-3 w-3 rounded-sm bg-success/40" />
        <span className="h-3 w-3 rounded-sm bg-success/70" />
        <span>{t("dataExplorer.ares.releases.calendar.more")}</span>
      </div>
    </div>
  );
}
