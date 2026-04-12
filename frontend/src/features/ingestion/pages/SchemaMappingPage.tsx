import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Sparkles,
  Check,
  X,
  ChevronDown,
  Database,
  Columns,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import {
  fetchSchemaMapping,
  suggestSchemaMapping,
  updateSchemaMapping,
  confirmSchemaMapping,
  fetchProfile,
} from "../api/ingestionApi";
import type { SchemaMapping, MappingLogic } from "@/types/ingestion";

const CDM_TABLES = [
  "person",
  "visit_occurrence",
  "condition_occurrence",
  "drug_exposure",
  "procedure_occurrence",
  "measurement",
  "observation",
] as const;

const LOGIC_LABELS: Record<MappingLogic, { label: string; color: string }> = {
  direct: { label: "Direct", color: "text-[#2DD4BF]" },
  transform: { label: "Transform", color: "text-[#A855F7]" },
  concat: { label: "Concat", color: "text-[#60A5FA]" },
  lookup: { label: "Lookup", color: "text-[#E5A84B]" },
  constant: { label: "Constant", color: "text-[#8A857D]" },
};

export default function SchemaMappingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const numericJobId = Number(jobId);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<SchemaMapping>>({});

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["schema-mapping", numericJobId],
    queryFn: () => fetchSchemaMapping(numericJobId),
    enabled: !!jobId,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", numericJobId],
    queryFn: () => fetchProfile(numericJobId),
    enabled: !!jobId,
  });

  const suggestMutation = useMutation({
    mutationFn: () => suggestSchemaMapping(numericJobId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["schema-mapping", numericJobId],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<SchemaMapping>[]) =>
      updateSchemaMapping(numericJobId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["schema-mapping", numericJobId],
      });
      setEditingId(null);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmSchemaMapping(numericJobId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["schema-mapping", numericJobId],
      });
    },
  });

  const groupedMappings = useMemo(() => {
    const groups: Record<string, SchemaMapping[]> = {};
    for (const m of mappings) {
      const key = m.cdm_table;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return groups;
  }, [mappings]);

  const stats = useMemo(() => {
    const total = mappings.length;
    const confirmed = mappings.filter((m) => m.is_confirmed).length;
    const highConf = mappings.filter((m) => m.confidence >= 0.8).length;
    return { total, confirmed, highConf };
  }, [mappings]);

  const handleStartEdit = useCallback((mapping: SchemaMapping) => {
    setEditingId(mapping.id);
    setEditValues({
      cdm_table: mapping.cdm_table,
      cdm_column: mapping.cdm_column,
      mapping_logic: mapping.mapping_logic,
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId === null) return;
    updateMutation.mutate([{ id: editingId, ...editValues }]);
  }, [editingId, editValues, updateMutation]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValues({});
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-[#9B1B30]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#F0EDE8]">
            Schema Mapping
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Map source columns to OMOP CDM tables and fields
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-[#9B1B30]/40 bg-[#9B1B30]/10 px-4 py-2 text-sm font-medium text-[#9B1B30] transition hover:bg-[#9B1B30]/20 disabled:opacity-50"
          >
            {suggestMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI Suggest
          </button>
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || stats.total === 0}
            className="flex items-center gap-2 rounded-lg bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 px-4 py-2 text-sm font-medium text-[#2DD4BF] transition hover:bg-[#2DD4BF]/20 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Confirm All
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 rounded-xl border border-[#232328] bg-[#151518] px-6 py-4">
        <div>
          <span className="text-2xl font-semibold font-['IBM_Plex_Mono',monospace] text-[#F0EDE8]">
            {stats.total}
          </span>
          <span className="ml-2 text-sm text-[#8A857D]">Mappings</span>
        </div>
        <div className="h-8 w-px bg-[#232328]" />
        <div>
          <span className="text-2xl font-semibold font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
            {stats.confirmed}
          </span>
          <span className="ml-2 text-sm text-[#8A857D]">Confirmed</span>
        </div>
        <div className="h-8 w-px bg-[#232328]" />
        <div>
          <span className="text-2xl font-semibold font-['IBM_Plex_Mono',monospace] text-[#60A5FA]">
            {stats.highConf}
          </span>
          <span className="ml-2 text-sm text-[#8A857D]">High Confidence</span>
        </div>
        {stats.total > 0 && (
          <>
            <div className="h-8 w-px bg-[#232328]" />
            <div className="flex-1">
              <div className="h-2 rounded-full bg-[#1A1A1E] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2DD4BF] transition-all"
                  style={{
                    width: `${(stats.confirmed / stats.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Source Columns Panel (unmapped) */}
      {profile?.fields && mappings.length === 0 && (
        <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Columns className="h-4 w-4 text-[#E5A84B]" />
            <h2 className="text-sm font-medium text-[#F0EDE8]">
              Source Columns
            </h2>
            <span className="text-xs text-[#8A857D]">
              ({profile.fields.length} columns detected)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {profile.fields.map((field) => (
              <div
                key={field.id}
                className="rounded-lg border border-[#232328] bg-[#1A1A1E] px-3 py-2"
              >
                <span className="text-sm font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
                  {field.column_name}
                </span>
                <span className="ml-2 text-xs text-[#5A5650]">
                  {field.inferred_type}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[#8A857D]">
            Click{" "}
            <span className="text-[#9B1B30] font-medium">AI Suggest</span> to
            auto-generate schema mappings from source columns to CDM tables.
          </p>
        </div>
      )}

      {/* Mapping Groups by CDM Table */}
      {CDM_TABLES.filter((t) => groupedMappings[t]?.length).map((table) => (
        <div
          key={table}
          className="rounded-xl border border-[#232328] bg-[#151518] overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-[#232328] bg-[#1A1A1E] px-6 py-3">
            <Database className="h-4 w-4 text-[#9B1B30]" />
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              {table}
            </h3>
            <span className="rounded-full bg-[#232328] px-2 py-0.5 text-xs text-[#8A857D]">
              {groupedMappings[table].length} columns
            </span>
          </div>
          <div className="divide-y divide-[#232328]">
            {groupedMappings[table].map((mapping) => (
              <div
                key={mapping.id}
                className={cn(
                  "flex items-center gap-4 px-6 py-3 transition",
                  mapping.is_confirmed
                    ? "bg-[#2DD4BF]/5"
                    : "hover:bg-[#1A1A1E]",
                )}
              >
                {/* Source Column */}
                <div className="w-48 shrink-0">
                  <span className="text-sm font-['IBM_Plex_Mono',monospace] text-[#E5A84B]">
                    {mapping.source_column}
                  </span>
                  {mapping.source_table && (
                    <span className="ml-1 text-xs text-[#5A5650]">
                      ({mapping.source_table})
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <ArrowRight className="h-4 w-4 shrink-0 text-[#5A5650]" />

                {/* CDM Column */}
                {editingId === mapping.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <select
                      value={editValues.cdm_table || mapping.cdm_table}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          cdm_table: e.target.value,
                        }))
                      }
                      className="rounded-md border border-[#232328] bg-[#0E0E11] px-2 py-1 text-sm text-[#F0EDE8]"
                    >
                      {CDM_TABLES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      value={editValues.cdm_column || mapping.cdm_column}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          cdm_column: e.target.value,
                        }))
                      }
                      className="rounded-md border border-[#232328] bg-[#0E0E11] px-2 py-1 text-sm text-[#F0EDE8] font-['IBM_Plex_Mono',monospace] w-48"
                    />
                    <select
                      value={editValues.mapping_logic || mapping.mapping_logic}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          mapping_logic: e.target.value as MappingLogic,
                        }))
                      }
                      className="rounded-md border border-[#232328] bg-[#0E0E11] px-2 py-1 text-sm text-[#F0EDE8]"
                    >
                      {Object.entries(LOGIC_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveEdit}
                      className="rounded p-1 text-[#2DD4BF] hover:bg-[#2DD4BF]/10"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="rounded p-1 text-[#E85A6B] hover:bg-[#E85A6B]/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex flex-1 items-center gap-3 cursor-pointer group"
                    onClick={() => handleStartEdit(mapping)}
                  >
                    <span className="text-sm font-['IBM_Plex_Mono',monospace] text-[#F0EDE8] group-hover:text-[#9B1B30] transition">
                      {mapping.cdm_column}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        LOGIC_LABELS[mapping.mapping_logic]?.color ||
                          "text-[#8A857D]",
                      )}
                    >
                      {LOGIC_LABELS[mapping.mapping_logic]?.label ||
                        mapping.mapping_logic}
                    </span>
                    <ChevronDown className="h-3 w-3 text-[#5A5650] opacity-0 group-hover:opacity-100 transition" />
                  </div>
                )}

                {/* Confidence */}
                <div className="w-24 shrink-0">
                  <ConfidenceBadge score={mapping.confidence} />
                </div>

                {/* Confirmed Status */}
                <div className="w-8 shrink-0">
                  {mapping.is_confirmed && (
                    <Check className="h-4 w-4 text-[#2DD4BF]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Empty State */}
      {mappings.length === 0 && !profile?.fields?.length && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-16">
          <Database className="h-10 w-10 text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D]">No schema mappings yet</p>
          <p className="mt-1 text-xs text-[#5A5650]">
            Upload and profile a file first, then generate AI suggestions
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => navigate(`/ingestion/jobs/${jobId}`)}
          className="rounded-lg border border-[#232328] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition"
        >
          Back to Job
        </button>
        <button
          onClick={() => navigate(`/ingestion/jobs/${jobId}/review`)}
          className="rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-[#F0EDE8] transition hover:bg-[#9B1B30]/80"
        >
          Continue to Concept Mapping
        </button>
      </div>
    </div>
  );
}
