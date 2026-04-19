import { useState } from "react";
import {
  LogIn, LogOut, KeyRound, Activity, Shield,
  ChevronLeft, ChevronRight, Search, X, Loader2, ScrollText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { useAuditLog, useAuditSummary } from "../hooks/useUserAudit";
import type { UserAuditEntry, AuditFilters } from "../api/adminApi";

// ── Design tokens ────────────────────────────────────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
const ACTION_CONFIG: Record<string, { color: string; icon: LucideIcon; labelKey: string }> = {
  login:            { color: "var(--success)", icon: LogIn,     labelKey: "login" },
  logout:           { color: "var(--text-muted)", icon: LogOut,    labelKey: "logout" },
  password_changed: { color: "var(--accent)", icon: KeyRound,  labelKey: "passwordChanged" },
  password_reset:   { color: "var(--critical)", icon: Shield,    labelKey: "passwordReset" },
  api_access:       { color: "var(--info)", icon: Activity,  labelKey: "featureAccess" },
};
const TABLE_HEADERS = ["time", "user", "action", "feature", "ipAddress"] as const;

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, color = "var(--text-secondary)", icon: Icon,
}: {
  label: string;
  value: number | string;
  color?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-4 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${color}12` }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <p
          className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
          style={{ color }}
        >
          {value}
        </p>
        <p className="text-[10px] text-text-ghost uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const { t } = useTranslation("app");
  const cfg = ACTION_CONFIG[action] ?? { color: "var(--text-muted)", icon: Activity, labelKey: "" };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
    >
      <Icon size={10} />
      {cfg.labelKey
        ? t(`administration.userAudit.actions.${cfg.labelKey}`)
        : action}
    </span>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation("app");

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay">
        <ScrollText size={24} className="text-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary">
        {filtered
          ? t("administration.userAudit.empty.noMatching")
          : t("administration.userAudit.empty.noEvents")}
      </h3>
      <p className="mt-2 max-w-md text-center text-sm text-text-muted">
        {filtered
          ? t("administration.userAudit.empty.adjustFilters")
          : t("administration.userAudit.empty.description")}
      </p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function UserAuditPage() {
  const { t } = useTranslation("app");
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, per_page: 50 });
  const [search, setSearch] = useState("");

  const { data, isLoading } = useAuditLog(filters);
  const { data: summary } = useAuditSummary();

  const entries: UserAuditEntry[] = data?.data ?? [];

  const filtered = search
    ? entries.filter(
        (e) =>
          e.user_name?.toLowerCase().includes(search.toLowerCase()) ||
          e.user_email?.toLowerCase().includes(search.toLowerCase()) ||
          (e.feature ?? "").includes(search.toLowerCase()) ||
          (e.ip_address ?? "").includes(search),
      )
    : entries;

  const isFiltered = !!(
    search || filters.action || filters.feature || filters.date_from || filters.date_to
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t("administration.userAudit.title")}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("administration.userAudit.subtitle")}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("administration.userAudit.stats.loginsToday")}
          value={summary?.logins_today ?? "—"}
          color="var(--success)"
          icon={LogIn}
        />
        <StatCard
          label={t("administration.userAudit.stats.activeUsers7d")}
          value={summary?.active_users_week ?? "—"}
          color="var(--info)"
          icon={Activity}
        />
        <StatCard
          label={t("administration.userAudit.stats.totalEvents")}
          value={data?.meta.total ?? "—"}
          color="var(--text-secondary)"
          icon={ScrollText}
        />
        <StatCard
          label={t("administration.userAudit.stats.topFeature")}
          value={summary?.top_features[0]?.feature ?? "—"}
          color="var(--accent)"
          icon={Shield}
        />
      </div>

      {/* Top features bar */}
      {summary?.top_features && summary.top_features.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-ghost">
            {t("administration.userAudit.sections.mostAccessedFeatures")}
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.top_features.map((f) => (
              <button
                key={f.feature}
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, feature: f.feature, page: 1 }))}
                className="inline-flex items-center gap-1.5 rounded border border-border-default bg-surface-overlay px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-surface-highlight hover:text-text-secondary"
              >
                <span className="font-['IBM_Plex_Mono',monospace]">{f.feature}</span>
                <span className="text-[10px] text-text-ghost">×{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("administration.userAudit.filters.searchPlaceholder")}
            className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-9 pr-8 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-muted"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Action filter */}
        <select
          value={filters.action ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: e.target.value || undefined, page: 1 }))
          }
          className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary focus:border-success focus:outline-none transition-colors"
        >
          <option value="">{t("administration.userAudit.filters.allActions")}</option>
          <option value="login">{t("administration.userAudit.actions.login")}</option>
          <option value="logout">{t("administration.userAudit.actions.logout")}</option>
          <option value="password_changed">{t("administration.userAudit.actions.passwordChanged")}</option>
          <option value="password_reset">{t("administration.userAudit.actions.passwordReset")}</option>
          <option value="api_access">{t("administration.userAudit.actions.featureAccess")}</option>
        </select>

        {/* Date from */}
        <input
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, date_from: e.target.value || undefined, page: 1 }))
          }
          className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary focus:border-success focus:outline-none transition-colors"
        />

        {/* Date to */}
        <input
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, date_to: e.target.value || undefined, page: 1 }))
          }
          className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary focus:border-success focus:outline-none transition-colors"
        />

        {/* Clear all */}
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilters({ page: 1, per_page: 50 });
            }}
            className="text-sm text-text-ghost transition-colors hover:text-text-muted"
          >
            {t("administration.userAudit.filters.clearAll")}
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-default bg-surface-raised">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay">
                {TABLE_HEADERS.map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted"
                  >
                    {t(`administration.userAudit.table.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-t border-border-subtle transition-colors",
                    i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                  )}
                >
                  {/* Time */}
                  <td className="px-4 py-3">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                      {formatDateTime(entry.occurred_at, {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </span>
                  </td>

                  {/* User */}
                  <td className="px-4 py-3">
                    {entry.user_name ? (
                      <div>
                        <p className="text-sm font-medium text-text-secondary">{entry.user_name}</p>
                        <p className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                          {entry.user_email}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-text-ghost">—</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    <ActionBadge action={entry.action} />
                  </td>

                  {/* Feature */}
                  <td className="px-4 py-3">
                    {entry.feature ? (
                      <button
                        type="button"
                        onClick={() =>
                          setFilters((f) => ({ ...f, feature: entry.feature ?? undefined, page: 1 }))
                        }
                        className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted transition-colors hover:text-success"
                      >
                        {entry.feature}
                      </button>
                    ) : (
                      <span className="text-xs text-text-ghost">—</span>
                    )}
                  </td>

                  {/* IP */}
                  <td className="px-4 py-3">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                      {entry.ip_address ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-text-ghost">
          <span>
            {t("administration.userAudit.pagination.page")}{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
              {data.meta.current_page}
            </span>{" "}
            {t("administration.userAudit.pagination.of")}{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
              {data.meta.last_page}
            </span>
            {" "}·{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-text-secondary">
              {formatNumber(data.meta.total)}
            </span>{" "}
            {t("administration.userAudit.pagination.events")}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.meta.current_page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="inline-flex items-center justify-center rounded-lg border border-border-default bg-surface-raised p-1.5 text-text-muted transition-colors hover:border-surface-highlight hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={data.meta.current_page === data.meta.last_page}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="inline-flex items-center justify-center rounded-lg border border-border-default bg-surface-raised p-1.5 text-text-muted transition-colors hover:border-surface-highlight hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
