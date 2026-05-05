import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import {
  useTemplate,
  useTemplates,
  useSubmitTemplateRun,
} from "../api/templates";
import type { TemplateManifest } from "../types/templates";
import { TemplateCard } from "../components/aqueduct/templates/TemplateCard";
import { ParameterForm } from "../components/aqueduct/templates/ParameterForm";

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-xl border border-border-default bg-surface-raised"
        />
      ))}
    </div>
  );
}

export function AqueductTemplatesPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const templatesQ = useTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const manifestQ = useTemplate(selectedId);
  const submitMut = useSubmitTemplateRun();

  const selectedTemplate = useMemo(
    () =>
      selectedId
        ? (templatesQ.data?.find((tpl) => tpl.id === selectedId) ?? null)
        : null,
    [selectedId, templatesQ.data],
  );

  // Effective manifest: prefer the fetched manifest (full nodes + post_conditions),
  // otherwise synthesize a minimal manifest from the cached catalog entry so the
  // ParameterForm can render synchronously and the user is not blocked by a fetch.
  const effectiveManifest: TemplateManifest | null = useMemo(() => {
    if (manifestQ.data) return manifestQ.data;
    if (selectedTemplate)
      return { ...selectedTemplate, nodes: [], post_conditions: [] };
    return null;
  }, [manifestQ.data, selectedTemplate]);

  function handleSubmit(parameters: Record<string, unknown>) {
    if (!effectiveManifest) return;
    submitMut.mutate(
      {
        templateId: effectiveManifest.id,
        version: effectiveManifest.version,
        parameters,
      },
      {
        onSuccess: (resp) => {
          setSelectedId(null);
          navigate(`/data-ingestion?tab=aqueduct&subtab=runs&run=${resp.id}`);
        },
      },
    );
  }

  if (templatesQ.isLoading) {
    return <SkeletonGrid />;
  }

  if (templatesQ.isError) {
    return (
      <div className="rounded-xl border border-critical/40 bg-critical/10 p-6 text-center text-sm text-critical">
        <p>
          {t("aqueduct.templates.error", {
            defaultValue:
              "Failed to load templates. Check that the templates service is running.",
          })}
        </p>
        <button
          type="button"
          onClick={() => templatesQ.refetch()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-critical/40 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/20"
        >
          {t("aqueduct.templates.retry", { defaultValue: "Retry" })}
        </button>
      </div>
    );
  }

  if (!templatesQ.data || templatesQ.data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-surface-raised p-12 text-center text-sm text-text-muted">
        {t("aqueduct.templates.empty", {
          defaultValue:
            "No templates available — check the templates service is running",
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templatesQ.data.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            id={tpl.id}
            name={tpl.name}
            description={tpl.description}
            category={tpl.category}
            tags={tpl.tags}
            cdm_versions={tpl.cdm_versions}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {selectedId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-border-default bg-surface-base p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {effectiveManifest?.name ?? selectedId}
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  {effectiveManifest?.description}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("aqueduct.parameterForm.close", {
                  defaultValue: "Close",
                })}
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-text-muted hover:bg-surface-overlay"
              >
                <X size={16} />
              </button>
            </div>
            {effectiveManifest ? (
              <ParameterForm
                manifest={effectiveManifest}
                onSubmit={handleSubmit}
                onCancel={() => setSelectedId(null)}
                pending={submitMut.isPending}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-muted" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
