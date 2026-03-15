import { useState } from "react";
import { ChevronLeft, ChevronRight, LogIn, LogOut, KeyRound, Activity, Shield } from "lucide-react";
import {
  DataTable, Badge, Button, SearchBar, Panel,
  type Column, type BadgeVariant,
} from "@/components/ui";
import { useAuditLog, useAuditSummary } from "../hooks/useUserAudit";
import type { UserAuditEntry, AuditFilters } from "../api/adminApi";

const ACTION_VARIANTS: Record<string, BadgeVariant> = {
  login:            "success",
  logout:           "inactive",
  password_changed: "warning",
  password_reset:   "critical",
  api_access:       "info",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  login:            <LogIn className="h-3.5 w-3.5" />,
  logout:           <LogOut className="h-3.5 w-3.5" />,
  password_changed: <KeyRound className="h-3.5 w-3.5" />,
  password_reset:   <Shield className="h-3.5 w-3.5" />,
  api_access:       <Activity className="h-3.5 w-3.5" />,
};

const ACTION_LABELS: Record<string, string> = {
  login:            "Login",
  logout:           "Logout",
  password_changed: "Password Changed",
  password_reset:   "Password Reset",
  api_access:       "Feature Access",
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Panel className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </Panel>
  );
}

export default function UserAuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, per_page: 50 });
  const [search, setSearch] = useState("");

  const { data, isLoading } = useAuditLog({
    ...filters,
    // search maps to user email/name — we do client-side for now since backend doesn't have it yet
  });
  const { data: summary } = useAuditSummary();

  const filtered = search
    ? (data?.data ?? []).filter(
        (e) =>
          e.user_name?.toLowerCase().includes(search.toLowerCase()) ||
          e.user_email?.toLowerCase().includes(search.toLowerCase()) ||
          e.feature?.includes(search) ||
          e.ip_address?.includes(search),
      )
    : (data?.data ?? []);

  const columns: Column<UserAuditEntry>[] = [
    {
      key: "occurred_at",
      header: "Time",
      sortable: false,
      render: (entry) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(entry.occurred_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: "user_name",
      header: "User",
      render: (entry) =>
        entry.user_name ? (
          <div>
            <p className="text-sm font-medium text-foreground">{entry.user_name}</p>
            <p className="font-mono text-xs text-muted-foreground">{entry.user_email}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      render: (entry) => (
        <Badge variant={ACTION_VARIANTS[entry.action] ?? "default"}>
          <span className="flex items-center gap-1">
            {ACTION_ICONS[entry.action]}
            {ACTION_LABELS[entry.action] ?? entry.action}
          </span>
        </Badge>
      ),
    },
    {
      key: "feature",
      header: "Feature",
      render: (entry) =>
        entry.feature ? (
          <span className="font-mono text-xs text-foreground">{entry.feature}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "ip_address",
      header: "IP Address",
      render: (entry) => (
        <span className="font-mono text-xs text-muted-foreground">
          {entry.ip_address ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track login events, feature access, and security actions across all users.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Logins Today" value={summary.logins_today} />
          <StatCard label="Active Users (7d)" value={summary.active_users_week} />
          <StatCard label="Total Events" value={data?.meta.total ?? "—"} />
          <StatCard
            label="Top Feature"
            value={summary.top_features[0]?.feature ?? "—"}
          />
        </div>
      )}

      {/* Top Features */}
      {summary?.top_features && summary.top_features.length > 0 && (
        <Panel>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Most Accessed Features (7 days)</h2>
          <div className="flex flex-wrap gap-2">
            {summary.top_features.map((f) => (
              <span
                key={f.feature}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                <span className="font-mono">{f.feature}</span>
                <span className="text-muted-foreground">×{f.count}</span>
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          placeholder="Search user, feature, IP…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs flex-1"
        />
        <select
          value={filters.action ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: e.target.value || undefined, page: 1 }))
          }
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All actions</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="password_changed">Password Changed</option>
          <option value="password_reset">Password Reset</option>
          <option value="api_access">Feature Access</option>
        </select>
        <input
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, date_from: e.target.value || undefined, page: 1 }))
          }
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="From"
        />
        <input
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, date_to: e.target.value || undefined, page: 1 }))
          }
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="To"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(e) => e.id}
        emptyMessage={isLoading ? "Loading…" : "No audit entries found."}
      />

      {/* Pagination */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.meta.current_page} of {data.meta.last_page} ({data.meta.total} events)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon
              disabled={data.meta.current_page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon
              disabled={data.meta.current_page === data.meta.last_page}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
