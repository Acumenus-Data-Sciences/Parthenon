import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  LayoutList,
  Activity,
  Database,
  ChevronDown,
  FlaskConical,
  Hospital,
  Download,
  GitBranch,
  AlertTriangle,
  Dna,
  ScanLine,
  Clock,
  User,
  Star,
  X,
  FileText,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useSourceStore } from "@/stores/sourceStore";
import { usePatientProfile, useProfileStats } from "../hooks/useProfiles";
import { PROFILE_DOMAIN_LIMIT } from "../api/profileApi";
import { PatientProfileHeader } from "../components/PatientProfileHeader";
import { PatientTimeline } from "../components/PatientTimeline";
import { ClinicalEventCard, GroupedConceptCard } from "../components/ClinicalEventCard";
import { CohortMemberList } from "../components/CohortMemberList";
import { EraTimeline } from "../components/EraTimeline";
import { PatientLabPanel } from "../components/PatientLabPanel";
import { PatientVisitView } from "../components/PatientVisitView";
import { PatientSearchPanel } from "../components/PatientSearchPanel";
import { ConceptDetailDrawer } from "../components/ConceptDetailDrawer";
import { PatientNotesTab } from "../components/PatientNotesTab";
import PrecisionMedicineTab from "@/features/radiogenomics/components/PrecisionMedicineTab";
import ImagingPatientTimeline from "@/features/imaging/components/PatientTimeline";
import { usePatientTimeline } from "@/features/imaging/hooks/useImaging";
import { useProfileStore } from "@/stores/profileStore";
import type { ClinicalEvent } from "../types/profile";
import {
  formatProfileTimeAgo,
  getProfileDomainLabel,
  getProfileGenderLabel,
  getProfileTabLabel,
  getProfileViewLabel,
  type ProfileDomainTab,
  type ProfileViewMode,
} from "../lib/i18n";

type ViewMode = ProfileViewMode;
type DomainTab = ProfileDomainTab;

const DOMAIN_TABS: DomainTab[] = [
  "all",
  "condition",
  "drug",
  "procedure",
  "measurement",
  "observation",
  "visit",
];

const VIEW_BUTTONS: {
  mode: ProfileViewMode;
  icon: React.ReactNode;
}[] = [
  { mode: "timeline", icon: <Activity size={12} /> },
  { mode: "list", icon: <LayoutList size={12} /> },
  { mode: "labs", icon: <FlaskConical size={12} /> },
  { mode: "imaging", icon: <ScanLine size={12} /> },
  { mode: "visits", icon: <Hospital size={12} /> },
  { mode: "notes", icon: <FileText size={12} /> },
  { mode: "eras", icon: <GitBranch size={12} /> },
  { mode: "precision", icon: <Dna size={12} /> },
];

function downloadEventsAsCsv(events: ClinicalEvent[], filename: string) {
  if (events.length === 0) return;
  const headers = [
    "domain",
    "concept_id",
    "concept_name",
    "start_date",
    "end_date",
    "value",
    "unit",
    "type_name",
    "vocabulary",
  ];
  const rows = events.map((e) =>
    [
      e.domain,
      e.concept_id,
      `"${(e.concept_name ?? "").replace(/"/g, '""')}"`,
      e.start_date,
      e.end_date ?? "",
      e.value ?? "",
      e.unit ?? "",
      e.type_name ?? "",
      e.vocabulary ?? "",
    ].join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PatientProfilePage() {
  const { t } = useTranslation("app");
  const { personId } = useParams<{ personId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { from?: string; fromLabel?: string } | null;

  const parsedPersonId = personId ? Number(personId) : null;
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [domainTab, setDomainTab] = useState<DomainTab>("all");
  const [selectedEvent, setSelectedEvent] = useState<ClinicalEvent | null>(null);
  const [groupList, setGroupList] = useState(true);

  const { recentProfiles, addRecentProfile, clearRecentProfiles } = useProfileStore();

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const userDefaultSourceId = useSourceStore((s) => s.defaultSourceId);
  const sourceIdParam = searchParams.get("sourceId");
  const sourceId = useMemo(() => {
    if (sourceIdParam) {
      const parsed = Number(sourceIdParam);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (!sources?.length) return null;
    const defaultSource = userDefaultSourceId
      ? sources.find((source) => source.id === userDefaultSourceId) ?? sources[0]
      : sources[0];
    return defaultSource?.id ?? null;
  }, [sourceIdParam, sources, userDefaultSourceId]);

  // Auto-select user's default source when no source is specified
  useEffect(() => {
    if (sourceIdParam || !parsedPersonId || !sourceId) return;
    setSearchParams({ sourceId: String(sourceId) }, { replace: true });
  }, [sourceId, sourceIdParam, parsedPersonId, setSearchParams]);

  const {
    data: profile,
    isLoading: loadingProfile,
    error: profileError,
  } = usePatientProfile(sourceId, parsedPersonId);

  const { data: profileStats } = useProfileStats(sourceId, parsedPersonId);

  // Record profile view when profile loads successfully
  useEffect(() => {
    if (!profile || !sourceId || !parsedPersonId || !sources) return;
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;
    addRecentProfile({
      personId: parsedPersonId,
      sourceId,
      sourceName: source.source_name,
      gender: profile.demographics.gender,
      yearOfBirth: profile.demographics.year_of_birth,
    });
  }, [profile, sourceId, parsedPersonId, sources, addRecentProfile]);

  // All events combined + sorted
  const allEvents = useMemo(() => {
    if (!profile) return [];
    return [
      ...profile.conditions,
      ...profile.drugs,
      ...profile.procedures,
      ...profile.measurements,
      ...profile.observations,
      ...profile.visits,
    ].sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );
  }, [profile]);

  const filteredEvents = useMemo(() => {
    if (domainTab === "all") return allEvents;
    return allEvents.filter((e) => e.domain === domainTab);
  }, [allEvents, domainTab]);

  // Group filteredEvents by concept for deduplicated list view
  const groupedEvents = useMemo(() => {
    const groups = new Map<
      string,
      { conceptId: number | null; conceptName: string; domain: string; events: ClinicalEvent[]; firstDate: string; lastDate: string }
    >();
    for (const ev of filteredEvents) {
      const key = `${ev.domain}::${ev.concept_id ?? "null"}::${ev.concept_name}`;
      if (!groups.has(key)) {
        groups.set(key, {
          conceptId: ev.concept_id ?? null,
          conceptName: ev.concept_name,
          domain: ev.domain,
          events: [],
          firstDate: ev.start_date,
          lastDate: ev.start_date,
        });
      }
      const g = groups.get(key)!;
      g.events.push(ev);
      if (ev.start_date < g.firstDate) g.firstDate = ev.start_date;
      if (ev.start_date > g.lastDate) g.lastDate = ev.start_date;
    }
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime(),
    );
  }, [filteredEvents]);

  const hasEras =
    (profile?.condition_eras?.length ?? 0) > 0 ||
    (profile?.drug_eras?.length ?? 0) > 0;

  // Domains where the loaded count equals the backend limit — likely truncated
  const truncatedDomains = useMemo(() => {
    if (!profile || !profileStats) return [];
    const domainMap: { key: keyof typeof profileStats; label: string; loaded: number }[] = [
      {
        key: "condition",
        label: getProfileDomainLabel(t, "condition", true),
        loaded: profile.conditions.length,
      },
      {
        key: "drug",
        label: getProfileDomainLabel(t, "drug", true),
        loaded: profile.drugs.length,
      },
      {
        key: "procedure",
        label: getProfileDomainLabel(t, "procedure", true),
        loaded: profile.procedures.length,
      },
      {
        key: "measurement",
        label: getProfileDomainLabel(t, "measurement", true),
        loaded: profile.measurements.length,
      },
      {
        key: "observation",
        label: getProfileDomainLabel(t, "observation", true),
        loaded: profile.observations.length,
      },
      {
        key: "visit",
        label: getProfileDomainLabel(t, "visit", true),
        loaded: profile.visits.length,
      },
    ];
    return domainMap
      .filter((d) => profileStats[d.key] > PROFILE_DOMAIN_LIMIT)
      .map((d) => ({ label: d.label, total: profileStats[d.key], loaded: d.loaded }));
  }, [profile, profileStats, t]);

  const handleSelectPerson = (sid: number, pid: number) => {
    navigate(`/profiles/${pid}?sourceId=${sid}`);
  };

  const handleSourceChange = (newSourceId: number | null) => {
    if (!parsedPersonId) return;
    if (newSourceId) {
      setSearchParams({ sourceId: String(newSourceId) });
      return;
    }
    setSearchParams({}, { replace: true });
  };

  const handleExportCsv = useCallback(() => {
    if (!profile || !parsedPersonId) return;
    const events =
      domainTab === "all"
        ? allEvents
        : allEvents.filter((e) => e.domain === domainTab);
    downloadEventsAsCsv(
      events,
      `patient-${parsedPersonId}-${domainTab}.csv`,
    );
  }, [profile, parsedPersonId, allEvents, domainTab]);

  // No personId: show search + cohort member selection + recent profiles
  if (!parsedPersonId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {t("profiles.page.title")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("profiles.page.subtitle")}
          </p>
        </div>

        {/* Recent Profiles */}
        {recentProfiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-text-muted" />
                <h2 className="text-sm font-semibold text-text-secondary">
                  {t("profiles.recent.title")}
                </h2>
                <span className="text-xs text-text-ghost">
                  ({recentProfiles.length})
                </span>
              </div>
              <button
                type="button"
                onClick={clearRecentProfiles}
                className="inline-flex items-center gap-1 text-[10px] text-text-ghost hover:text-text-muted transition-colors"
              >
                <X size={10} />
                {t("profiles.recent.clear")}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recentProfiles.map((rp) => (
                <button
                  key={`${rp.sourceId}-${rp.personId}`}
                  type="button"
                  onClick={() => handleSelectPerson(rp.sourceId, rp.personId)}
                  className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-left hover:border-success/30 hover:bg-surface-overlay transition-colors group"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success/10 shrink-0">
                    <User size={14} className="text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-success font-['IBM_Plex_Mono',monospace]">
                        #{rp.personId}
                      </span>
                      <span className="text-xs text-text-muted">
                        {getProfileGenderLabel(t, rp.gender)} ·{" "}
                        {t("profiles.header.demographics.years", {
                          count: new Date().getFullYear() - rp.yearOfBirth,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Database size={9} className="text-text-ghost shrink-0" />
                      <span className="text-[10px] text-text-ghost truncate">
                        {rp.sourceName}
                      </span>
                      <span className="text-[10px] text-text-disabled shrink-0">
                        · {formatProfileTimeAgo(t, rp.viewedAt)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <CohortMemberList onSelectPerson={handleSelectPerson} />
      </div>
    );
  }

  // Profile view
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate(navState?.from ?? "/profiles")}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            {navState?.fromLabel ?? t("profiles.page.title")}
          </button>
          <h1 className="text-2xl font-bold text-text-primary">
            {t("profiles.page.titleSingle")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("profiles.common.personLabel", { id: parsedPersonId })}
          </p>
        </div>

        {/* Right side: source selector + quick patient search */}
        <div className="flex items-start gap-3 shrink-0">
          {/* Quick-jump patient search (only when source selected) */}
          {sourceId && (
            <div className="w-72">
              <PatientSearchPanel
                onSelectPerson={handleSelectPerson}
                sourceId={sourceId}
              />
            </div>
          )}

          {/* Source selector */}
          <div className="relative">
            {(() => {
              const selectedSource = sources?.find((s) => s.id === sourceId);
              return selectedSource && selectedSource.id === userDefaultSourceId ? (
                <Star
                  size={12}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-accent fill-accent"
                />
              ) : (
                <Database
                  size={12}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
                />
              );
            })()}
            <select
              value={sourceId ?? ""}
              onChange={(e) => handleSourceChange(Number(e.target.value) || null)}
              disabled={loadingSources}
              className={cn(
                "appearance-none rounded-lg border border-border-default bg-surface-base pl-8 pr-8 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            >
              <option value="">{t("profiles.common.selectSource")}</option>
              {sources?.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.id === userDefaultSourceId ? "\u2605 " : ""}{src.source_name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
          </div>
        </div>
      </div>

      {/* Source required */}
      {!sourceId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
          <Database size={24} className="text-text-ghost mb-3" />
          <p className="text-sm text-text-muted">
            {t("profiles.page.selectSourcePrompt")}
          </p>
        </div>
      )}

      {/* Loading */}
      {sourceId && loadingProfile && (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      )}

      {/* Error */}
      {sourceId && profileError && (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-critical text-sm">
              {t("profiles.page.failedToLoad")}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {t("profiles.page.patientNotFound", {
                id: parsedPersonId,
              })}
            </p>
          </div>
        </div>
      )}

      {/* Profile data */}
      {sourceId && profile && (
        <>
          {/* Patient identity + stats */}
          <PatientProfileHeader
            profile={profile}
            stats={profileStats}
            onDrillDown={(view, domain) => {
              setViewMode(view as ViewMode);
              if (domain) setDomainTab(domain as DomainTab);
            }}
          />

          {/* Find Similar action */}
          <div className="flex justify-end">
            <button
              onClick={() => navigate(`/patient-similarity?person_id=${parsedPersonId}&source_id=${sourceId}`)}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <UsersRound size={13} />
              {t("profiles.page.findSimilarPatients")}
            </button>
          </div>

          {/* Truncation warning */}
          {truncatedDomains.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
              <AlertTriangle size={14} className="text-accent shrink-0 mt-0.5" />
              <div className="text-xs text-accent">
                <span className="font-semibold">
                  {t("profiles.page.truncation.headline", {
                    limit: PROFILE_DOMAIN_LIMIT.toLocaleString(),
                  })}{" "}
                </span>
                {t("profiles.page.truncation.detail")}{" "}
                {truncatedDomains.map((d, i) => (
                  <span key={d.label}>
                    {i > 0 && " · "}
                    {t("profiles.page.truncation.domainSummary", {
                      label: d.label,
                      loaded: d.loaded.toLocaleString(),
                      total: d.total.toLocaleString(),
                    })}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* View controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">
              {t("profiles.page.clinicalEvents", {
                count: allEvents.length,
              })}
            </span>

            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-border-default bg-surface-base p-0.5">
                {VIEW_BUTTONS.filter(
                  (b) => b.mode !== "eras" || hasEras,
                ).map(({ mode, icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      viewMode === mode
                        ? "bg-success/10 text-success"
                        : "text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {icon}
                    {getProfileViewLabel(t, mode)}
                  </button>
                ))}
              </div>

              {/* Export CSV (only in list view) */}
              {viewMode === "list" && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-highlight px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-text-ghost transition-colors"
                >
                  <Download size={12} />
                  {t("profiles.common.actions.exportCsv")}
                </button>
              )}
            </div>
          </div>

          {/* Timeline view */}
          {viewMode === "timeline" && (
            <PatientTimeline
              events={allEvents}
              observationPeriods={profile.observation_periods}
              onEventClick={setSelectedEvent}
            />
          )}

          {/* Labs view */}
          {viewMode === "labs" && (
            <PatientLabPanel labGroups={profile.labGroups ?? []} />
          )}

          {/* Imaging view */}
          {viewMode === "imaging" && parsedPersonId && (
            <PatientImagingView personId={parsedPersonId} />
          )}

          {/* Visits view */}
          {viewMode === "visits" && (
            <PatientVisitView events={allEvents} />
          )}

          {/* Notes view */}
          {viewMode === "notes" && parsedPersonId && sourceId && (
            <PatientNotesTab personId={parsedPersonId} sourceId={sourceId} />
          )}

          {/* Eras view */}
          {viewMode === "eras" && (
            <EraTimeline
              conditionEras={profile.condition_eras ?? []}
              drugEras={profile.drug_eras ?? []}
            />
          )}

          {/* Precision Medicine view */}
          {viewMode === "precision" && parsedPersonId && (
            <PrecisionMedicineTab
              personId={parsedPersonId}
              sourceId={sourceId ?? undefined}
            />
          )}

          {/* List view */}
          {viewMode === "list" && (
            <div className="space-y-4">
              {/* Domain tabs + grouping toggle */}
              <div className="flex items-center justify-between gap-3 border-b border-border-default overflow-x-auto">
                <div className="flex items-center gap-1">
                  {DOMAIN_TABS.map((tab) => {
                    const count =
                      tab === "all"
                        ? allEvents.length
                        : allEvents.filter((e) => e.domain === tab).length;
                    if (tab !== "all" && count === 0) return null;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setDomainTab(tab)}
                        className={cn(
                          "relative px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                          domainTab === tab
                            ? "text-success"
                            : "text-text-muted hover:text-text-secondary",
                        )}
                      >
                        {getProfileTabLabel(t, tab)}{" "}
                        <span className="text-[10px] opacity-60">({count})</span>
                        {domainTab === tab && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setGroupList((v) => !v)}
                  className={cn(
                    "shrink-0 mb-1 text-[10px] px-2.5 py-1 rounded border transition-colors",
                    groupList
                      ? "border-success/40 text-success bg-success/5"
                      : "border-surface-highlight text-text-muted hover:text-text-primary",
                  )}
                >
                  {groupList
                    ? t("profiles.page.listToggle.grouped", {
                        count: groupedEvents.length,
                      })
                    : t("profiles.page.listToggle.events", {
                        count: filteredEvents.length,
                      })}
                </button>
              </div>

              {/* Event cards */}
              {filteredEvents.length === 0 ? (
                <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
                  <p className="text-sm text-text-muted">
                    {t("profiles.page.noEventsInCategory")}
                  </p>
                </div>
              ) : groupList ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groupedEvents.map((group, i) => (
                    <GroupedConceptCard
                      key={i}
                      conceptId={group.conceptId}
                      conceptName={group.conceptName}
                      domain={group.domain as import("../types/profile").ClinicalDomain}
                      events={group.events}
                      firstDate={group.firstDate}
                      lastDate={group.lastDate}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredEvents.map((event, i) => (
                    <ClinicalEventCard key={i} event={event} />
                  ))}
                </div>
              )}
            </div>
          )}
        <ConceptDetailDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      </>
    )}
    </div>
  );
}

// ── Embedded Imaging View ──────────────────────────────────────────────

function PatientImagingView({ personId }: { personId: number }) {
  const { t } = useTranslation("app");
  const { data: timeline, isLoading, error } = usePatientTimeline(personId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-info" />
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <ScanLine size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">
          {error
            ? t("profiles.page.imaging.failedToLoad")
            : t("profiles.page.imaging.noStudies")}
        </p>
      </div>
    );
  }

  return (
    <ImagingPatientTimeline
      data={timeline}
      isLoading={false}
      error={null}
    />
  );
}
