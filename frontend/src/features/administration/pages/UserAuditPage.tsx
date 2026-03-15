import { useState } from "react";
import {
  LogIn, LogOut, KeyRound, Activity, Shield,
  ChevronLeft, ChevronRight, Search, X, Loader2, ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuditLog, useAuditSummary } from "../hooks/useUserAudit";
import type { UserAuditEntry, AuditFilters } from "../api/adminApi";

// ── Design tokens ────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  login:            { color: "#2DD4BF", icon: LogIn,     label: "Login" },
  logout:           { color: "#8A857D", icon: LogOut,    label: "Logout" },
  password_changed: { color: "#C9A227", icon: KeyRound,  label: "Password Changed" },
  password_reset:   { color: "#E85A6B", icon: Shield,    label: "Password Reset" },
  api_access:       { color: "#60A5FA", icon: Activity,  label: "Feature Access" },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, color = "#C5C0B8", icon: Icon,
}: {
  label: string;
  value: number | string;
  color?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
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
        <p className="text-[10px] text-[#5A5650] uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] ?? { color: "#8A857D", icon: Activity, label: action };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1C1C20]">
        <ScrollText size={24} className="text-[#8A857D]" />
      </div>
      <h3 className="text-lg font-semibold text-[#F0EDE8]">
        {filtered ? "No matching events" : "No audit events yet"}
      </h3>
      <p className="mt-2 max-w-md text-center text-sm text-[#8A857D]">
        {filtered
          ? "Try adjusting your filters or date range."
          : "Audit events are recorded as users log in and access platform features."}
      </p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function UserAuditPage() {
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
        <h1 className="text-2xl font-bold text-[#F0EDE8]">User Audit Log</h1>
        <p className="mt-1 text-sm text-[#8A857D]">
          Track login events, feature access, and security actions across all users.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Logins Today"
          value={summary?.logins_today ?? "—"}
          color="#2DD4BF"
          icon={LogIn}
        />
        <StatCard
          label="Active Users (7d)"
          value={summary?.active_users_week ?? "—"}
          color="#60A5FA"
          icon={Activity}
        />
        <StatCard
          label="Total Events"
          value={data?.meta.total ?? "—"}
          color="#C5C0B8"
          icon={ScrollText}
        />
        <StatCard
          label="Top Feature"
          value={summary?.top_features[0]?.feature ?? "—"}
          color="#C9A227"
          icon={Shield}
        />
      </div>

      {/* Top features bar */}
      {summary?.top_features && summary.top_features.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#5A5650]">
            Most Accessed Features — Last 7 Days
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.top_features.map((f) => (
              <button
                key={f.feature}
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, feature: f.feature, page: 1 }))}
                className="inline-flex items-center gap-1.5 rounded border border-[#2A2A30] bg-[#1A1A1F] px-2.5 py-1 text-xs text-[#8A857D] transition-colors hover:border-[#3A3A42] hover:text-[#C5C0B8]"
              >
                <span className="font-['IBM_Plex_Mono',monospace]">{f.feature}</span>
                <span className="text-[10px] text-[#5A5650]">×{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, feature, IP…"
            className="w-full rounded-lg border border-[#232328] bg-[#151518] py-2 pl-9 pr-8 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#8A857D]"
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
          className="rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#C5C0B8] focus:border-[#2DD4BF] focus:outline-none transition-colors"
        >
          <option value="">All actions</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="password_changed">Password Changed</option>
          <option value="password_reset">Password Reset</option>
          <option value="api_access">Feature Access</option>
        </select>

        {/* Date from */}
        <input
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, date_from: e.target.value || undefined, page: 1 }))
          }
          className="rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#C5C0B8] focus:border-[#2DD4BF] focus:outline-none transition-colors"
        />

        {/* Date to */}
        <input
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, date_to: e.target.value || undefined, page: 1 }))
          }
          className="rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#C5C0B8] focus:border-[#2DD4BF] focus:outline-none transition-colors"
        />

        {/* Clear all */}
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilters({ page: 1, per_page: 50 });
            }}
            className="text-sm text-[#5A5650] transition-colors hover:text-[#8A857D]"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-[#8A857D]" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#232328] bg-[#151518]">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1C1C20]">
                {["Time", "User", "Action", "Feature", "IP Address"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-t border-[#1C1C20] transition-colors",
                    i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                  )}
                >
                  {/* Time */}
                  <td className="px-4 py-3">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">
                      {new Date(entry.occurred_at).toLocaleString("en-US", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </span>
                  </td>

                  {/* User */}
                  <td className="px-4 py-3">
                    {entry.user_name ? (
                      <div>
                        <p className="text-sm font-medium text-[#C5C0B8]">{entry.user_name}</p>
                        <p className="font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">
                          {entry.user_email}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-[#5A5650]">—</span>
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
                        className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D] transition-colors hover:text-[#2DD4BF]"
                      >
                        {entry.feature}
                      </button>
                    ) : (
                      <span className="text-xs text-[#5A5650]">—</span>
                    )}
                  </td>

                  {/* IP */}
                  <td className="px-4 py-3">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">
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
        <div className="flex items-center justify-between text-sm text-[#5A5650]">
          <span>
            Page{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
              {data.meta.current_page}
            </span>{" "}
            of{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
              {data.meta.last_page}
            </span>
            {" "}·{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
              {data.meta.total.toLocaleString()}
            </span>{" "}
            events
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.meta.current_page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="inline-flex items-center justify-center rounded-lg border border-[#2A2A30] bg-[#151518] p-1.5 text-[#8A857D] transition-colors hover:border-[#3A3A42] hover:text-[#C5C0B8] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={data.meta.current_page === data.meta.last_page}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="inline-flex items-center justify-center rounded-lg border border-[#2A2A30] bg-[#151518] p-1.5 text-[#8A857D] transition-colors hover:border-[#3A3A42] hover:text-[#C5C0B8] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
