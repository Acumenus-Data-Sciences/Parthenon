import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Loader2, Plus, Radio, RefreshCcw } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useSurveyInstrument, useSurveyInstruments } from "../../hooks/useSurveyInstruments";
import {
  useActivateCampaign,
  useCampaign,
  useCampaignConductRecords,
  useCampaigns,
  useCloseCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useImportCampaignResponses,
  useStoreConductResponses,
} from "../../hooks/useCampaigns";
import { CampaignCard } from "./CampaignCard";
import { ImportResponsesModal } from "./ImportResponsesModal";
import { ManualEntryModal } from "./ManualEntryModal";
import { NewCampaignModal } from "./NewCampaignModal";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";

const FILTERS = ["all", "draft", "active", "closed"] as const;

type FilterId = (typeof FILTERS)[number];

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation("app");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-raised px-6 py-16 text-center">
      <ClipboardList size={32} className="mb-3 text-text-ghost" />
      <h3 className="text-sm font-medium text-text-primary">
        {t("standardPros.conduct.emptyTitle")}
      </h3>
      <p className="mt-1 max-w-lg text-xs leading-relaxed text-text-muted">
        {t("standardPros.conduct.emptyMessage")}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base"
      >
        <Plus size={14} />
        {t("standardPros.common.newCampaign")}
      </button>
    </div>
  );
}

export function ConductTab() {
  const { t } = useTranslation("app");
  const [filter, setFilter] = useState<FilterId>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState<number | null>(null);
  const [importCampaignId, setImportCampaignId] = useState<number | null>(null);
  const [manualCampaignId, setManualCampaignId] = useState<number | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<{
    campaignName: string;
    processed: number;
    matched: number;
    missing: number;
    createdResponses: number;
  } | null>(null);

  const campaignQuery = useCampaigns({
    status: filter === "all" ? undefined : filter,
    per_page: 50,
  });
  const instrumentsQuery = useSurveyInstruments({ per_page: 200, sort: "name", dir: "asc" });
  const cohortsQuery = useCohortDefinitions({ limit: 200, with_generations: true });

  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const activateCampaign = useActivateCampaign();
  const closeCampaign = useCloseCampaign();
  const deleteCampaign = useDeleteCampaign();
  const importResponses = useImportCampaignResponses();
  const storeResponses = useStoreConductResponses();
  const editCampaignQuery = useCampaign(editCampaignId);

  const campaignDetails = campaignQuery.data?.data ?? [];

  const selectedImportCampaign = campaignDetails.find((campaign) => campaign.id === importCampaignId) ?? null;
  const selectedManualCampaign = campaignDetails.find((campaign) => campaign.id === manualCampaignId) ?? null;
  const selectedInstrumentId =
    selectedImportCampaign?.survey_instrument_id ??
    selectedManualCampaign?.survey_instrument_id ??
    0;
  const instrumentDetailQuery = useSurveyInstrument(selectedInstrumentId);
  const conductRecordsQuery = useCampaignConductRecords(manualCampaignId, { status: "pending" });

  const isLoading = campaignQuery.isLoading;
  const isMutating =
    createCampaign.isPending ||
    updateCampaign.isPending ||
    activateCampaign.isPending ||
    closeCampaign.isPending ||
    deleteCampaign.isPending ||
    importResponses.isPending ||
    storeResponses.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-xl border border-border-default bg-surface-raised p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-success" />
                <h2 className="text-sm font-semibold text-text-primary">
                  {t("standardPros.conduct.title")}
                </h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {t("standardPros.conduct.subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => campaignQuery.refetch()}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary"
              >
                <RefreshCcw size={12} />
                {t("standardPros.common.refresh")}
              </button>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-success px-3 py-2 text-xs font-medium text-surface-base"
              >
                <Plus size={12} />
                {t("standardPros.common.newCampaign")}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === option
                    ? "bg-success/10 text-success"
                    : "bg-surface-base text-text-muted hover:text-text-primary"
                }`}
              >
                {t(`standardPros.conduct.filters.${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border-default bg-surface-raised p-4">
            <div className="text-lg font-semibold text-success">{campaignQuery.data?.total ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-text-ghost">
              {t("standardPros.conduct.campaignsCount")}
            </div>
          </div>
          <div className="rounded-xl border border-border-default bg-surface-raised p-4">
            <div className="text-lg font-semibold text-accent">
              {campaignDetails.filter((campaign) => campaign.status === "draft").length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-text-ghost">
              {t("standardPros.conduct.filters.draft")}
            </div>
          </div>
          <div className="rounded-xl border border-border-default bg-surface-raised p-4">
            <div className="text-lg font-semibold text-domain-observation">
              {campaignDetails.filter((campaign) => campaign.status === "active").length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-text-ghost">
              {t("standardPros.conduct.filters.active")}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {lastImportSummary && (
            <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3">
              <div className="text-xs font-medium text-success">
                {t("standardPros.conduct.importComplete", {
                  campaignName: lastImportSummary.campaignName,
                })}
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                {t("standardPros.conduct.importSummary", {
                  processed: lastImportSummary.processed,
                  matched: lastImportSummary.matched,
                  missing: lastImportSummary.missing,
                  createdResponses: lastImportSummary.createdResponses,
                })}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-text-muted" />
              <span className="ml-2 text-sm text-text-muted">
                {t("standardPros.common.loadingCampaigns")}
              </span>
            </div>
          )}

          {!isLoading && campaignDetails.length === 0 && (
            <EmptyState onCreate={() => setIsCreateOpen(true)} />
          )}

          {!isLoading && campaignDetails.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              isMutating={isMutating}
              onActivate={(id) => activateCampaign.mutate(id, {
                onSuccess: () => {
                  toast.success(t("standardPros.conduct.activateSuccess"));
                },
                onError: () => {
                  toast.error(t("standardPros.conduct.activateFailed"));
                },
              })}
              onClose={(id) => closeCampaign.mutate(id, {
                onSuccess: () => {
                  toast.success(t("standardPros.conduct.closeSuccess"));
                },
                onError: () => {
                  toast.error(t("standardPros.conduct.closeFailed"));
                },
              })}
              onDelete={(id) => {
                const target = campaignDetails.find((entry) => entry.id === id);
                const confirmed = window.confirm(
                  t("standardPros.conduct.deleteConfirm", { name: target?.name ?? id }),
                );

                if (!confirmed) {
                  return;
                }

                deleteCampaign.mutate(id, {
                  onSuccess: () => {
                    toast.success(t("standardPros.conduct.deleteSuccess"));
                  },
                  onError: () => {
                    toast.error(t("standardPros.conduct.deleteFailed"));
                  },
                });
              }}
              onEdit={(id) => setEditCampaignId(id)}
              onImport={(id) => setImportCampaignId(id)}
              onManualEntry={(id) => setManualCampaignId(id)}
            />
          ))}
        </div>
      </div>

      <NewCampaignModal
        open={isCreateOpen}
        mode="create"
        onClose={() => setIsCreateOpen(false)}
        instruments={instrumentsQuery.data?.data ?? []}
        cohorts={cohortsQuery.data?.items ?? []}
        isSaving={createCampaign.isPending}
        onSubmit={(payload) => {
          createCampaign.mutate(payload, {
            onSuccess: () => {
              setIsCreateOpen(false);
              toast.success(t("standardPros.conduct.createSuccess"));
            },
            onError: () => {
              toast.error(t("standardPros.conduct.createFailed"));
            },
          });
        }}
      />

      <NewCampaignModal
        open={editCampaignId != null}
        mode="edit"
        onClose={() => setEditCampaignId(null)}
        instruments={instrumentsQuery.data?.data ?? []}
        cohorts={cohortsQuery.data?.items ?? []}
        initialCampaign={editCampaignQuery.data ?? null}
        isSaving={updateCampaign.isPending}
        onSubmit={(payload) => {
          if (editCampaignId == null) {
            return;
          }

          updateCampaign.mutate(
            { id: editCampaignId, payload },
            {
              onSuccess: () => {
                setEditCampaignId(null);
                toast.success(t("standardPros.conduct.updateSuccess"));
              },
              onError: () => {
                toast.error(t("standardPros.conduct.updateFailed"));
              },
            },
          );
        }}
      />

      <ImportResponsesModal
        open={importCampaignId != null}
        onClose={() => setImportCampaignId(null)}
        campaign={selectedImportCampaign}
        instrument={instrumentDetailQuery.data ?? null}
        isSubmitting={importResponses.isPending}
        onSubmit={(csv) => {
          if (importCampaignId == null) {
            return;
          }
          importResponses.mutate(
            { id: importCampaignId, csv },
            {
              onSuccess: (result) => {
                setLastImportSummary({
                  campaignName: selectedImportCampaign?.name ?? t("standardPros.common.campaign"),
                  processed: result.processed,
                  matched: result.matched,
                  missing: result.missing,
                  createdResponses: result.created_responses,
                });
                setImportCampaignId(null);
                toast.success(t("standardPros.conduct.importResponsesSuccess"));
              },
              onError: () => {
                toast.error(t("standardPros.conduct.importResponsesFailed"));
              },
            },
          );
        }}
      />

      <ManualEntryModal
        open={manualCampaignId != null}
        onClose={() => setManualCampaignId(null)}
        campaign={selectedManualCampaign}
        instrument={instrumentDetailQuery.data ?? null}
        conductRecords={conductRecordsQuery.data ?? []}
        isSubmitting={storeResponses.isPending}
        onSubmit={(conductId, responses) => {
          if (manualCampaignId == null) {
            return;
          }
          storeResponses.mutate(
            { conductId, campaignId: manualCampaignId, responses },
            {
              onSuccess: () => {
                setManualCampaignId(null);
                toast.success(t("standardPros.conduct.saveResponsesSuccess"));
              },
              onError: () => {
                toast.error(t("standardPros.conduct.saveResponsesFailed"));
              },
            },
          );
        }}
      />
    </>
  );
}
