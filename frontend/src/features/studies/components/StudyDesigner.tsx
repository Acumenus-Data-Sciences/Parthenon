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
  { value: "characterization", label: "Characterization" },
  { value: "population_level_estimation", label: "Population-Level Estimation" },
  { value: "patient_level_prediction", label: "Patient-Level Prediction" },
  { value: "drug_utilization", label: "Drug Utilization" },
  { value: "quality_improvement", label: "Quality Improvement" },
  { value: "comparative_effectiveness", label: "Comparative Effectiveness" },
  { value: "safety_surveillance", label: "Safety Surveillance" },
  { value: "custom", label: "Custom" },
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [studyType, setStudyType] = useState("characterization");

  const [addType, setAddType] = useState("characterization");
  const [addId, setAddId] = useState<number | null>(null);

  const updateMutation = useUpdateStudy();
  const addAnalysisMutation = useAddStudyAnalysis();
  const removeAnalysisMutation = useRemoveStudyAnalysis();

  const { data: studyAnalyses } = useStudyAnalyses(study.slug);

  const { data: charData } = useCharacterizations(1);
  const { data: irData } = useIncidenceRates(1);
  const { data: pathwayData } = usePathways(1);
  const { data: estData } = useEstimations(1);
  const { data: predData } = usePredictions(1);

  useEffect(() => {
    setTitle(study.title || study.name || "");
    setDescription(study.description ?? "");
    setStudyType(study.study_type || "characterization");
  }, [study]);

  const getAnalysisOptions = () => {
    switch (addType) {
      case "characterization":
        return charData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "incidence-rate":
        return irData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "pathway":
        return (
          pathwayData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? []
        );
      case "estimation":
        return estData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "prediction":
        return predData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      default:
        return [];
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;
    updateMutation.mutate({
      idOrSlug: study.slug || study.id,
      payload: {
        title: title.trim(),
        description: description.trim(),
        study_type: studyType,
      },
    });
  };

  const handleAddAnalysis = () => {
    if (!addId) return;
    addAnalysisMutation.mutate(
      {
        slug: study.slug,
        payload: { analysis_type: addType, analysis_id: addId },
      },
      {
        onSuccess: () => setAddId(null),
      },
    );
  };

  const handleRemoveAnalysis = (entry: StudyAnalysisEntry) => {
    removeAnalysisMutation.mutate({
      slug: study.slug,
      entryId: entry.id,
    });
  };

  const isSaving = updateMutation.isPending;
  const analysisOptions = getAnalysisOptions();

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Basic Information
        </h3>
        <div className="space-y-3 mt-3">
          <div>
            <label className="form-label">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Study title"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="form-input form-textarea"
            />
          </div>
          <div>
            <label className="form-label">Study Type</label>
            <select
              value={studyType}
              onChange={(e) => setStudyType(e.target.value)}
              className="form-input form-select"
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
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Add Analysis
        </h3>
        <div className="flex items-end gap-3 mt-3">
          <div className="flex-1">
            <label className="form-label">Analysis Type</label>
            <select
              value={addType}
              onChange={(e) => {
                setAddType(e.target.value);
                setAddId(null);
              }}
              className="form-input form-select"
            >
              {ANALYSIS_TYPES.map((at) => (
                <option key={at.value} value={at.value}>
                  {at.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="form-label">Analysis</label>
            <select
              value={addId ?? ""}
              onChange={(e) =>
                setAddId(Number(e.target.value) || null)
              }
              className="form-input form-select"
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
            className="btn btn-primary btn-sm"
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
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Study Analyses ({studyAnalyses?.length ?? 0})
        </h3>
        {!studyAnalyses || studyAnalyses.length === 0 ? (
          <p className="mt-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
            No analyses added yet.
          </p>
        ) : (
          <div className="space-y-2 mt-3">
            {studyAnalyses.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ border: "1px solid var(--border-default)", background: "var(--surface-overlay)" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "badge",
                      entry.analysis_type === "estimation"
                        ? "badge-critical"
                        : entry.analysis_type === "prediction"
                          ? "badge-warning"
                          : "badge-info",
                    )}
                  >
                    {entry.analysis_type}
                  </span>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    {entry.analysis?.name ?? `Analysis #${entry.analysis_id}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAnalysis(entry)}
                  disabled={removeAnalysisMutation.isPending}
                  style={{ color: "var(--text-muted)", transition: "color 150ms" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--critical)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
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
          disabled={isSaving || !title.trim()}
          className="btn btn-primary"
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
