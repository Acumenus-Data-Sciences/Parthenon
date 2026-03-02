import { useState, useEffect } from "react";
import { Loader2, Save, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Study, StudyAnalysisEntry } from "../types/study";
import {
  useUpdateStudy,
  useAddStudyAnalysis,
  useRemoveStudyAnalysis,
  useStudyAnalyses,
} from "../hooks/useStudies";
import { useCharacterizations } from "@/features/analyses/hooks/useCharacterizations";
import { useIncidenceRates } from "@/features/analyses/hooks/useIncidenceRates";
import { usePathways } from "@/features/pathways/hooks/usePathways";
import { useEstimations } from "@/features/estimation/hooks/useEstimations";
import { usePredictions } from "@/features/prediction/hooks/usePredictions";

const STUDY_TYPES = [
  { value: "Estimation", label: "Estimation" },
  { value: "Prediction", label: "Prediction" },
  { value: "Characterization", label: "Characterization" },
  { value: "Mixed", label: "Mixed" },
];

const ANALYSIS_TYPES = [
  { value: "characterization", label: "Characterization" },
  { value: "incidence-rate", label: "Incidence Rate" },
  { value: "pathway", label: "Pathway" },
  { value: "estimation", label: "Estimation" },
  { value: "prediction", label: "Prediction" },
];

interface StudyDesignerProps {
  study: Study;
}

export function StudyDesigner({ study }: StudyDesignerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [studyType, setStudyType] = useState("Mixed");

  const [addType, setAddType] = useState("characterization");
  const [addId, setAddId] = useState<number | null>(null);

  const updateMutation = useUpdateStudy();
  const addAnalysisMutation = useAddStudyAnalysis();
  const removeAnalysisMutation = useRemoveStudyAnalysis();

  const { data: studyAnalyses } = useStudyAnalyses(study.id);

  // Load analyses for each type
  const { data: charData } = useCharacterizations(1);
  const { data: irData } = useIncidenceRates(1);
  const { data: pathwayData } = usePathways(1);
  const { data: estData } = useEstimations(1);
  const { data: predData } = usePredictions(1);

  useEffect(() => {
    setName(study.name);
    setDescription(study.description ?? "");
    setStudyType(study.study_type || "Mixed");
  }, [study]);

  const getAnalysisOptions = () => {
    switch (addType) {
      case "characterization":
        return charData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "incidence-rate":
        return irData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "pathway":
        return (
          pathwayData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? []
        );
      case "estimation":
        return estData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "prediction":
        return predData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      default:
        return [];
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    updateMutation.mutate({
      id: study.id,
      payload: {
        name: name.trim(),
        description: description.trim(),
        study_type: studyType,
      },
    });
  };

  const handleAddAnalysis = () => {
    if (!addId) return;
    addAnalysisMutation.mutate(
      {
        studyId: study.id,
        payload: { analysis_type: addType, analysis_id: addId },
      },
      {
        onSuccess: () => setAddId(null),
      },
    );
  };

  const handleRemoveAnalysis = (entry: StudyAnalysisEntry) => {
    removeAnalysisMutation.mutate({
      studyId: study.id,
      entryId: entry.id,
    });
  };

  const isSaving = updateMutation.isPending;
  const analysisOptions = getAnalysisOptions();

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Basic Information
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Study name"
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] placeholder:text-[#5A5650]",
                "focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] placeholder:text-[#5A5650] resize-none",
                "focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Study Type
            </label>
            <select
              value={studyType}
              onChange={(e) => setStudyType(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            >
              {STUDY_TYPES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add Analysis */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Add Analysis
        </h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Analysis Type
            </label>
            <select
              value={addType}
              onChange={(e) => {
                setAddType(e.target.value);
                setAddId(null);
              }}
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            >
              {ANALYSIS_TYPES.map((at) => (
                <option key={at.value} value={at.value}>
                  {at.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Analysis
            </label>
            <select
              value={addId ?? ""}
              onChange={(e) =>
                setAddId(Number(e.target.value) || null)
              }
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            >
              <option value="">Select analysis...</option>
              {analysisOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddAnalysis}
            disabled={!addId || addAnalysisMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-3 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
          >
            {addAnalysisMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add
          </button>
        </div>
      </div>

      {/* Current Analyses */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Study Analyses ({studyAnalyses?.length ?? 0})
        </h3>
        {!studyAnalyses || studyAnalyses.length === 0 ? (
          <p className="text-xs text-[#5A5650]">
            No analyses added yet.
          </p>
        ) : (
          <div className="space-y-2">
            {studyAnalyses.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      entry.analysis_type === "estimation"
                        ? "bg-[#9B1B30]/10 text-[#E85A6B]"
                        : entry.analysis_type === "prediction"
                          ? "bg-[#C9A227]/10 text-[#C9A227]"
                          : "bg-[#2DD4BF]/10 text-[#2DD4BF]",
                    )}
                  >
                    {entry.analysis_type}
                  </span>
                  <span className="text-sm text-[#F0EDE8]">
                    {entry.analysis?.name ?? `Analysis #${entry.analysis_id}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAnalysis(entry)}
                  disabled={removeAnalysisMutation.isPending}
                  className="text-[#8A857D] hover:text-[#E85A6B] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Changes
        </button>
      </div>
    </div>
  );
}
