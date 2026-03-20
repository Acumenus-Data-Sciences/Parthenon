import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, CircleAlert, HelpCircle, PanelsTopLeft, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useFinnGenServices } from "../hooks/useFinnGenServices";
import { WorkflowStepper } from "../components/WorkflowStepper";
import { RomopapiTab } from "../components/RomopapiTab";
import { HadesExtrasTab } from "../components/HadesExtrasTab";
import { CohortOpsTab } from "../components/CohortOpsTab";
import { Co2AnalysisTab } from "../components/Co2AnalysisTab";
import type { ServiceName } from "../components/workbenchShared";
import { getSchemaQualifier } from "../components/workbenchShared";
import type { FinnGenSource } from "../types";

const serviceOrder: ServiceName[] = [
  "finngen_romopapi",
  "finngen_hades_extras",
  "finngen_cohort_operations",
  "finngen_co2_analysis",
];

export default function FinnGenToolsPage() {
  const { data, isLoading, isError, refetch, isFetching } =
    useFinnGenServices();

  // ── Source state ────────────────────────────────────────────────
  const [sources, setSources] = useState<FinnGenSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(
    null,
  );
  const [activeService, setActiveService] =
    useState<ServiceName>("finngen_romopapi");

  // ── Cross-tool handoff state ────────────────────────────────────
  const [co2CohortContext, setCo2CohortContext] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [cohortLabel, setCohortLabel] = useState("Acumenus diabetes cohort");
  const [outcomeName, setOutcomeName] = useState("Heart failure");
  const [hadesContext, setHadesContext] = useState<Record<string, unknown> | null>(null);
  const [cohortOpsContext, setCohortOpsContext] = useState<Record<string, unknown> | null>(null);

  // ── Track completed workflow steps ─────────────────────────────
  const [completedSteps, setCompletedSteps] = useState<Set<ServiceName>>(
    new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    setSourcesLoading(true);
    fetchSources()
      .then((result) => {
        if (cancelled) return;
        setSources(result);
        const defaultSource =
          result.find((source) => source.is_default) ?? result[0] ?? null;
        setSelectedSourceId(
          (current) => current ?? defaultSource?.id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      })
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const services = useMemo(() => {
    const items = data?.services ?? [];
    return [...items].sort((left, right) => {
      const li = serviceOrder.indexOf(left.name as ServiceName);
      const ri = serviceOrder.indexOf(right.name as ServiceName);
      return (
        (li === -1 ? Number.MAX_SAFE_INTEGER : li) -
        (ri === -1 ? Number.MAX_SAFE_INTEGER : ri)
      );
    });
  }, [data?.services]);

  const finngenServices = useMemo(
    () =>
      services.filter((service) =>
        String(service.name).startsWith("finngen_"),
      ),
    [services],
  );

  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ??
    sources[0] ??
    null;
  const warningCount = data?.warnings.length ?? 0;

  const handleHandoffToHades = useCallback(
    (context: Record<string, unknown>) => {
      setHadesContext(context);
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add("finngen_romopapi");
        return next;
      });
      setActiveService("finngen_hades_extras");
    },
    [],
  );

  const handleHandoffToCohortOps = useCallback(
    (context: Record<string, unknown>) => {
      setCohortOpsContext(context);
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add("finngen_hades_extras");
        return next;
      });
      setActiveService("finngen_cohort_operations");
    },
    [],
  );

  const handleHandoffToCo2 = useCallback(
    (
      context: Record<string, unknown>,
      label: string,
      outcome: string,
    ) => {
      setCo2CohortContext(context);
      setCohortLabel(label);
      setOutcomeName(outcome);
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add("finngen_cohort_operations");
        return next;
      });
      setActiveService("finngen_co2_analysis");
    },
    [],
  );

  const hasActiveServices = finngenServices.length > 0 || isLoading;

  return (
    <div className="space-y-4">
      {/* ── Compact header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 40,
            height: 40,
            backgroundColor: "rgba(155, 27, 48, 0.18)",
            flexShrink: 0,
          }}
        >
          <PanelsTopLeft size={20} style={{ color: "#9B1B30" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#F0EDE8",
                margin: 0,
              }}
            >
              Workbench
            </h1>
            <Link
              to="/workbench/finngen/help"
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
              title="Workbench Help"
            >
              <HelpCircle size={15} />
            </Link>
          </div>
        </div>

        {/* SDK link */}
        <a
          href="/docs/community-workbench-sdk"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-1.5 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/20"
        >
          SDK
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>

        <Link
          to="/workbench"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Workbench
        </Link>

        {/* CDM Source selector */}
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            CDM
          </span>
          <select
            value={selectedSourceId ?? ""}
            onChange={(e) => {
              const nextId = Number(e.target.value);
              setSelectedSourceId(nextId);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.source_name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* ── Source detail line ────────────────────────────────── */}
      {selectedSource ? (
        <div className="text-xs text-zinc-500">
          {selectedSource.source_key} · {selectedSource.source_dialect} ·
          CDM: {getSchemaQualifier(selectedSource, "cdm") || "n/a"} ·
          Results:{" "}
          {getSchemaQualifier(selectedSource, "results") || "n/a"}
        </div>
      ) : sourcesLoading ? (
        <div className="text-xs text-zinc-500">
          Loading visible sources...
        </div>
      ) : null}

      {/* ── Workflow stepper ──────────────────────────────────── */}
      <WorkflowStepper
        activeService={activeService}
        onSelect={setActiveService}
        completedSteps={completedSteps}
      />

      {/* ── Active tab ────────────────────────────────────────── */}
      {hasActiveServices ? (
        <>
          {activeService === "finngen_romopapi" ? (
            <RomopapiTab
              selectedSource={selectedSource}
              onHandoffToHades={handleHandoffToHades}
            />
          ) : null}
          {activeService === "finngen_hades_extras" ? (
            <HadesExtrasTab
              selectedSource={selectedSource}
              hadesContext={hadesContext}
              onHandoffToCohortOps={handleHandoffToCohortOps}
            />
          ) : null}
          {activeService === "finngen_cohort_operations" ? (
            <CohortOpsTab
              selectedSource={selectedSource}
              cohortOpsContext={cohortOpsContext}
              onHandoffToCo2={handleHandoffToCo2}
            />
          ) : null}
          {activeService === "finngen_co2_analysis" ? (
            <Co2AnalysisTab
              selectedSource={selectedSource}
              cohortContext={{
                co2CohortContext,
                cohortLabel,
                outcomeName,
              }}
            />
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
          No FINNGEN services are visible yet. Enable the FINNGEN flags in
          the StudyAgent runtime.
        </div>
      )}

      {/* ── Warning banner ────────────────────────────────────── */}
      {(isError || warningCount > 0) && (
        <div className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 p-4">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />
            <div>
              <div className="text-sm font-medium text-[#F0EDE8]">
                Registry diagnostics
              </div>
              <div className="mt-1 space-y-1 text-sm text-zinc-300">
                {isError ? (
                  <div>
                    Workbench metadata could not be loaded from
                    StudyAgent.
                  </div>
                ) : null}
                {data?.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
