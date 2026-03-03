import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  LayoutList,
  Activity,
  Database,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { usePatientProfile } from "../hooks/useProfiles";
import { PatientDemographicsCard } from "../components/PatientDemographicsCard";
import { PatientTimeline } from "../components/PatientTimeline";
import { ClinicalEventCard } from "../components/ClinicalEventCard";
import { CohortMemberList } from "../components/CohortMemberList";
import { EraTimeline } from "../components/EraTimeline";
import type { ClinicalDomain, ClinicalEvent } from "../types/profile";

type ViewMode = "timeline" | "list" | "eras";
type DomainTab =
  | "all"
  | "condition"
  | "drug"
  | "procedure"
  | "measurement"
  | "observation"
  | "visit";

const DOMAIN_TABS: { key: DomainTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "condition", label: "Conditions" },
  { key: "drug", label: "Drugs" },
  { key: "procedure", label: "Procedures" },
  { key: "measurement", label: "Measurements" },
  { key: "observation", label: "Observations" },
  { key: "visit", label: "Visits" },
];

export default function PatientProfilePage() {
  const { personId } = useParams<{ personId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const parsedPersonId = personId ? Number(personId) : null;
  const sourceIdParam = searchParams.get("sourceId");
  const [sourceId, setSourceId] = useState<number | null>(
    sourceIdParam ? Number(sourceIdParam) : null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [domainTab, setDomainTab] = useState<DomainTab>("all");

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const {
    data: profile,
    isLoading: loadingProfile,
    error: profileError,
  } = usePatientProfile(sourceId, parsedPersonId);

  // All events combined
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
        new Date(b.start_date).getTime() -
        new Date(a.start_date).getTime(),
    );
  }, [profile]);

  const filteredEvents = useMemo(() => {
    if (domainTab === "all") return allEvents;
    return allEvents.filter((e) => e.domain === domainTab);
  }, [allEvents, domainTab]);

  const handleSelectPerson = (sid: number, pid: number) => {
    setSourceId(sid);
    navigate(`/profiles/${pid}?sourceId=${sid}`);
  };

  const handleSourceChange = (newSourceId: number | null) => {
    setSourceId(newSourceId);
    if (parsedPersonId && newSourceId) {
      setSearchParams({ sourceId: String(newSourceId) });
    }
  };

  // No personId: show cohort member selection
  if (!parsedPersonId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Patient Profiles
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Browse cohort members or search by Person ID to view detailed
            patient profiles
          </p>
        </div>
        <CohortMemberList onSelectPerson={handleSelectPerson} />
      </div>
    );
  }

  // Has personId: show profile
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/profiles")}
            className="inline-flex items-center gap-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Patient Profiles
          </button>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Patient Profile
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Person #{parsedPersonId}
          </p>
        </div>

        {/* Source selector */}
        <div className="relative shrink-0">
          <Database
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <select
            value={sourceId ?? ""}
            onChange={(e) =>
              handleSourceChange(Number(e.target.value) || null)
            }
            disabled={loadingSources}
            className={cn(
              "appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] pl-8 pr-8 py-2 text-sm",
              "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          >
            <option value="">Select source...</option>
            {sources?.map((src) => (
              <option key={src.id} value={src.id}>
                {src.source_name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
        </div>
      </div>

      {/* Source required */}
      {!sourceId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
          <Database size={24} className="text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D]">
            Please select a data source to load the patient profile.
          </p>
        </div>
      )}

      {/* Loading */}
      {sourceId && loadingProfile && (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* Error */}
      {sourceId && profileError && (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-[#E85A6B] text-sm">
              Failed to load patient profile
            </p>
            <p className="mt-1 text-xs text-[#8A857D]">
              Person #{parsedPersonId} may not exist in this data source.
            </p>
          </div>
        </div>
      )}

      {/* Profile data */}
      {sourceId && profile && (
        <>
          {/* Demographics */}
          <PatientDemographicsCard
            demographics={profile.demographics}
            observationPeriods={profile.observation_periods}
          />

          {/* View toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#F0EDE8]">
              Clinical Events ({allEvents.length})
            </span>
            <div className="flex items-center gap-1 rounded-lg border border-[#232328] bg-[#0E0E11] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "timeline"
                    ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                    : "text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                <Activity size={12} />
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                    : "text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                <LayoutList size={12} />
                List
              </button>
              {((profile.condition_eras?.length ?? 0) > 0 ||
                (profile.drug_eras?.length ?? 0) > 0) && (
                <button
                  type="button"
                  onClick={() => setViewMode("eras")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "eras"
                      ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : "text-[#8A857D] hover:text-[#C5C0B8]",
                  )}
                >
                  <Database size={12} />
                  Eras
                </button>
              )}
            </div>
          </div>

          {/* Timeline view */}
          {viewMode === "timeline" && (
            <PatientTimeline events={allEvents} />
          )}

          {/* Eras view */}
          {viewMode === "eras" && (
            <EraTimeline
              conditionEras={profile.condition_eras ?? []}
              drugEras={profile.drug_eras ?? []}
            />
          )}

          {/* List view */}
          {viewMode === "list" && (
            <div className="space-y-4">
              {/* Domain tabs */}
              <div className="flex items-center gap-1 border-b border-[#232328] overflow-x-auto">
                {DOMAIN_TABS.map((tab) => {
                  const count =
                    tab.key === "all"
                      ? allEvents.length
                      : allEvents.filter((e) => e.domain === tab.key)
                          .length;
                  if (tab.key !== "all" && count === 0) return null;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setDomainTab(tab.key)}
                      className={cn(
                        "relative px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                        domainTab === tab.key
                          ? "text-[#2DD4BF]"
                          : "text-[#8A857D] hover:text-[#C5C0B8]",
                      )}
                    >
                      {tab.label}{" "}
                      <span className="text-[10px] opacity-60">
                        ({count})
                      </span>
                      {domainTab === tab.key && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2DD4BF]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Event cards */}
              {filteredEvents.length === 0 ? (
                <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
                  <p className="text-sm text-[#8A857D]">
                    No events in this category
                  </p>
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
        </>
      )}
    </div>
  );
}
