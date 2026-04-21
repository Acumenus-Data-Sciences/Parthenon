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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("app");
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
    { id: "sql" as const, label: t("cohortDefinitions.auto.generatedSql_f3a6a7"), icon: Code },
    { id: "validate" as const, label: t("cohortDefinitions.auto.validation_131487"), icon: AlertTriangle },
    { id: "markdown" as const, label: t("cohortDefinitions.auto.printFriendly_ad43c1"), icon: FileText },
  ];

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-overlay">
        <div className="flex items-center gap-2">
          <Code size={14} className="text-primary" />
          <h4 className="text-sm font-semibold text-text-primary">
            {t("cohortDefinitions.auto.circeCompiler_f30d9a")}
          </h4>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-primary/15 text-primary">
            {t("cohortDefinitions.auto.python_a7f5f3")}
          </span>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-border-default px-3 py-1.5 bg-surface-raised">
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
                ? "bg-surface-elevated text-text-primary"
                : "text-text-ghost hover:text-text-muted"
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
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-border-default">
            <button
              type="button"
              onClick={() => compileMutation.mutate()}
              disabled={compileMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              {compileMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Code size={12} />
              )}
              {t("cohortDefinitions.auto.compile_3de938")}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!compileMutation.data?.sql}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40"
            >
              {copied ? (
                <Check size={12} className="text-success" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {compileMutation.isPending ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-text-muted" />
              </div>
            ) : compileMutation.data?.sql ? (
              <pre className="p-4 text-xs leading-relaxed text-text-secondary font-['IBM_Plex_Mono',monospace] whitespace-pre-wrap break-words">
                {compileMutation.data.sql}
              </pre>
            ) : compileMutation.isError ? (
              <div className="flex items-center justify-center py-12 text-xs text-critical">
                {t("cohortDefinitions.auto.failedToCompileEnsureTheExpressionIsSaved_450172")}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-xs text-text-ghost">
                {t("cohortDefinitions.auto.clickCompileToGenerateOhdsiSqlFromThe_e80a8a")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation section */}
      {activeSection === "validate" && (
        <div>
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-border-default">
            <button
              type="button"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-surface-accent text-text-primary hover:bg-surface-overlay disabled:opacity-50"
            >
              {validateMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <AlertTriangle size={12} />
              )}
              {t("cohortDefinitions.auto.validate_ad3d06")}
            </button>
          </div>
          <div className="p-4">
            {validateMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-text-muted" />
              </div>
            ) : validateMutation.data ? (
              validateMutation.data.valid ? (
                <div className="flex items-center gap-2 text-success text-sm">
                  <Check size={16} />
                  {t("cohortDefinitions.auto.noValidationIssuesFound_50fe8e")}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-primary mb-3">
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
                            : "border-border-default bg-surface-overlay text-text-secondary"
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
              <div className="text-xs text-critical">
                {t("cohortDefinitions.auto.validationFailedEnsureTheExpressionIsSaved_c2c0a6")}
              </div>
            ) : (
              <div className="text-xs text-text-ghost text-center py-8">
                {t("cohortDefinitions.auto.clickValidateToRun24DesignChecks_7fe40a")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Markdown section */}
      {activeSection === "markdown" && (
        <div>
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-border-default">
            <button
              type="button"
              onClick={() => renderMutation.mutate()}
              disabled={renderMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-surface-accent text-text-primary hover:bg-surface-overlay disabled:opacity-50"
            >
              {renderMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FileText size={12} />
              )}
              {t("cohortDefinitions.auto.render_5e520d")}
            </button>
            {renderMutation.data?.markdown && (
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-border-default text-text-muted hover:text-text-primary transition-colors"
              >
                {t("cohortDefinitions.auto.exportMd_2419e8")}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto p-4">
            {renderMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-text-muted" />
              </div>
            ) : renderMutation.data?.markdown ? (
              <div className="prose prose-invert prose-sm max-w-none text-text-secondary">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed font-['IBM_Plex_Mono',monospace]">
                  {renderMutation.data.markdown}
                </pre>
              </div>
            ) : renderMutation.isError ? (
              <div className="text-xs text-critical">
                {t("cohortDefinitions.auto.renderFailedEnsureTheExpressionIsSaved_b513ec")}
              </div>
            ) : (
              <div className="text-xs text-text-ghost text-center py-8">
                {t("cohortDefinitions.auto.clickRenderToGenerateAHumanReadableDescription_563f20")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
