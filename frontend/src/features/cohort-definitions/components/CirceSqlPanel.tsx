import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  Copy,
  Check,
  Code,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";

interface CirceCompileResponse {
  sql: string;
  cohort_id: number;
  generate_stats: boolean;
}

interface CirceValidationWarning {
  message: string;
  severity: string;
}

interface CirceValidateResponse {
  valid: boolean;
  warnings: CirceValidationWarning[];
}

interface CirceRenderResponse {
  markdown: string;
}

async function compileCohort(
  expression: Record<string, unknown>,
  cdmSchema = "cdm",
  vocabSchema = "vocab",
  cohortId = 1
): Promise<CirceCompileResponse> {
  const { data } = await apiClient.post("/circe/compile", {
    expression,
    cdm_schema: cdmSchema,
    vocabulary_schema: vocabSchema,
    cohort_id: cohortId,
  });
  return data.data;
}

async function validateCohort(
  expression: Record<string, unknown>
): Promise<CirceValidateResponse> {
  const { data } = await apiClient.post("/circe/validate", { expression });
  return data.data;
}

async function renderCohort(
  expression: Record<string, unknown>
): Promise<CirceRenderResponse> {
  const { data } = await apiClient.post("/circe/render", { expression });
  return data.data;
}

interface CirceSqlPanelProps {
  definitionId: number | null;
}

export function CirceSqlPanel({ definitionId }: CirceSqlPanelProps) {
  const { expression } = useCohortExpressionStore();
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "sql" | "validate" | "markdown"
  >("sql");

  const compileMutation = useMutation({
    mutationFn: () =>
      compileCohort(
        expression as unknown as Record<string, unknown>,
        "cdm",
        "vocab",
        definitionId ?? 1
      ),
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      validateCohort(expression as unknown as Record<string, unknown>),
  });

  const renderMutation = useMutation({
    mutationFn: () =>
      renderCohort(expression as unknown as Record<string, unknown>),
  });

  const handleCopy = async () => {
    if (!compileMutation.data?.sql) return;
    await navigator.clipboard.writeText(compileMutation.data.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!renderMutation.data?.markdown) return;
    const blob = new Blob([renderMutation.data.markdown], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cohort-${definitionId ?? "draft"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections = [
    { id: "sql" as const, label: "Generated SQL", icon: Code },
    { id: "validate" as const, label: "Validation", icon: AlertTriangle },
    { id: "markdown" as const, label: "Print Friendly", icon: FileText },
  ];

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1C1C20]">
        <div className="flex items-center gap-2">
          <Code size={14} className="text-[#9B1B30]" />
          <h4 className="text-sm font-semibold text-[#F0EDE8]">
            Circe Compiler
          </h4>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-[#9B1B30]/15 text-[#9B1B30]">
            Python
          </span>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-[#232328] px-3 py-1.5 bg-[#18181C]">
        {sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => {
              setActiveSection(sec.id);
              if (sec.id === "sql" && !compileMutation.data) {
                compileMutation.mutate();
              } else if (sec.id === "validate" && !validateMutation.data) {
                validateMutation.mutate();
              } else if (sec.id === "markdown" && !renderMutation.data) {
                renderMutation.mutate();
              }
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSection === sec.id
                ? "bg-[#232328] text-[#F0EDE8]"
                : "text-[#5A5650] hover:text-[#8A857D]"
            )}
          >
            <sec.icon size={12} />
            {sec.label}
          </button>
        ))}
      </div>

      {/* SQL section */}
      {activeSection === "sql" && (
        <div>
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-[#232328]">
            <button
              type="button"
              onClick={() => compileMutation.mutate()}
              disabled={compileMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-[#9B1B30] text-white hover:bg-[#9B1B30]/80 disabled:opacity-50"
            >
              {compileMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Code size={12} />
              )}
              Compile
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!compileMutation.data?.sql}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40"
            >
              {copied ? (
                <Check size={12} className="text-[#2DD4BF]" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {compileMutation.isPending ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-[#8A857D]" />
              </div>
            ) : compileMutation.data?.sql ? (
              <pre className="p-4 text-xs leading-relaxed text-[#C5C0B8] font-['IBM_Plex_Mono',monospace] whitespace-pre-wrap break-words">
                {compileMutation.data.sql}
              </pre>
            ) : compileMutation.isError ? (
              <div className="flex items-center justify-center py-12 text-xs text-[#E85A6B]">
                Failed to compile. Ensure the expression is saved.
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-xs text-[#5A5650]">
                Click Compile to generate OHDSI SQL from the cohort expression
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation section */}
      {activeSection === "validate" && (
        <div>
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-[#232328]">
            <button
              type="button"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-surface-accent text-white hover:bg-surface-overlay disabled:opacity-50"
            >
              {validateMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <AlertTriangle size={12} />
              )}
              Validate
            </button>
          </div>
          <div className="p-4">
            {validateMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-[#8A857D]" />
              </div>
            ) : validateMutation.data ? (
              validateMutation.data.valid ? (
                <div className="flex items-center gap-2 text-[#2DD4BF] text-sm">
                  <Check size={16} />
                  No validation issues found
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#F0EDE8] mb-3">
                    {validateMutation.data.warnings.length} issue
                    {validateMutation.data.warnings.length !== 1 ? "s" : ""}{" "}
                    found
                  </p>
                  {validateMutation.data.warnings.map((w, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs",
                        w.severity === "ERROR"
                          ? "border-red-800/50 bg-red-900/20 text-red-300"
                          : w.severity === "WARNING"
                            ? "border-yellow-800/50 bg-yellow-900/20 text-yellow-300"
                            : "border-[#232328] bg-[#1A1A1F] text-[#C5C0B8]"
                      )}
                    >
                      <span className="font-mono text-[10px] uppercase opacity-60">
                        [{w.severity}]
                      </span>{" "}
                      {w.message}
                    </div>
                  ))}
                </div>
              )
            ) : validateMutation.isError ? (
              <div className="text-xs text-[#E85A6B]">
                Validation failed. Ensure the expression is saved.
              </div>
            ) : (
              <div className="text-xs text-[#5A5650] text-center py-8">
                Click Validate to run 24 design checks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Markdown section */}
      {activeSection === "markdown" && (
        <div>
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-[#232328]">
            <button
              type="button"
              onClick={() => renderMutation.mutate()}
              disabled={renderMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-surface-accent text-white hover:bg-surface-overlay disabled:opacity-50"
            >
              {renderMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FileText size={12} />
              )}
              Render
            </button>
            {renderMutation.data?.markdown && (
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-[#232328] text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
              >
                Export .md
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto p-4">
            {renderMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-[#8A857D]" />
              </div>
            ) : renderMutation.data?.markdown ? (
              <div className="prose prose-invert prose-sm max-w-none text-[#C5C0B8]">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed font-['IBM_Plex_Mono',monospace]">
                  {renderMutation.data.markdown}
                </pre>
              </div>
            ) : renderMutation.isError ? (
              <div className="text-xs text-[#E85A6B]">
                Render failed. Ensure the expression is saved.
              </div>
            ) : (
              <div className="text-xs text-[#5A5650] text-center py-8">
                Click Render to generate a human-readable description
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
