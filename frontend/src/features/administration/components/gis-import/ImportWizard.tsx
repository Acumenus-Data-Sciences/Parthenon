import { useState, useCallback } from "react";
import { Upload, Brain, Columns3, Settings, CheckCircle2, Loader2 } from "lucide-react";
import type {
  ImportWizardState,
  ColumnSuggestion,
  ColumnMapping,
  ImportConfig,
  ValidationResult,
  UploadResult,
} from "../../types/gisImport";
import { UploadStep } from "./UploadStep";
import { AnalyzeStep } from "./AnalyzeStep";
import { MappingStep } from "./MappingStep";
import { ConfigureStep } from "./ConfigureStep";
import { ValidateStep } from "./ValidateStep";
import { ImportStep } from "./ImportStep";

const STEPS = [
  { label: "Upload", icon: Upload },
  { label: "Analyze", icon: Brain },
  { label: "Map Columns", icon: Columns3 },
  { label: "Configure", icon: Settings },
  { label: "Validate", icon: CheckCircle2 },
  { label: "Import", icon: Loader2 },
];

export function ImportWizard() {
  const [state, setState] = useState<ImportWizardState>({
    step: 0,
    importId: null,
    preview: null,
    suggestions: [],
    mapping: {},
    config: {},
    validation: null,
  });

  const goTo = useCallback((step: number) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const handleUploadComplete = useCallback((result: UploadResult) => {
    setState((s) => ({
      ...s,
      importId: result.import_id,
      preview: result.preview,
      step: 1,
    }));
  }, []);

  const handleAnalysisComplete = useCallback((suggestions: ColumnSuggestion[]) => {
    // Auto-apply high-confidence suggestions as initial mapping
    const autoMapping: ColumnMapping = {};
    for (const s of suggestions) {
      if (s.confidence >= 0.5) {
        autoMapping[s.column] = {
          purpose: s.purpose,
          geo_type: s.geo_type ?? undefined,
          exposure_type: s.exposure_type ?? undefined,
        };
      }
    }
    setState((s) => ({
      ...s,
      suggestions,
      mapping: autoMapping,
      step: 2,
    }));
  }, []);

  const handleMappingComplete = useCallback((mapping: ColumnMapping) => {
    setState((s) => ({ ...s, mapping, step: 3 }));
  }, []);

  const handleConfigComplete = useCallback((config: ImportConfig) => {
    setState((s) => ({ ...s, config, step: 4 }));
  }, []);

  const handleValidationComplete = useCallback((validation: ValidationResult) => {
    setState((s) => ({ ...s, validation, step: 5 }));
  }, []);

  const handleReset = useCallback(() => {
    setState({
      step: 0,
      importId: null,
      preview: null,
      suggestions: [],
      mapping: {},
      config: {},
      validation: null,
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === state.step;
          const isDone = i < state.step;
          return (
            <div key={s.label} className="flex items-center">
              <button
                onClick={() => i < state.step && goTo(i)}
                disabled={i >= state.step}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition ${
                  isActive
                    ? "bg-accent/20 text-accent"
                    : isDone
                      ? "text-success hover:text-success/80 cursor-pointer"
                      : "text-text-ghost"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-px w-4 ${isDone ? "bg-success" : "bg-surface-highlight"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {state.step === 0 && <UploadStep onComplete={handleUploadComplete} />}
      {state.step === 1 && state.importId && (
        <AnalyzeStep importId={state.importId} onComplete={handleAnalysisComplete} />
      )}
      {state.step === 2 && state.importId && state.preview && (
        <MappingStep
          importId={state.importId}
          headers={state.preview.headers}
          suggestions={state.suggestions}
          mapping={state.mapping}
          onComplete={handleMappingComplete}
        />
      )}
      {state.step === 3 && state.importId && (
        <ConfigureStep
          importId={state.importId}
          suggestions={state.suggestions}
          onComplete={handleConfigComplete}
        />
      )}
      {state.step === 4 && state.importId && (
        <ValidateStep
          importId={state.importId}
          onComplete={handleValidationComplete}
          onBack={() => goTo(2)}
        />
      )}
      {state.step === 5 && state.importId && (
        <ImportStep
          importId={state.importId}
          mapping={state.mapping}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
