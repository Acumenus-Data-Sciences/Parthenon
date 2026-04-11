import { useState, useEffect } from "react";
import { Loader2, Save, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  EvidenceSynthesisDesign,
  EvidenceSynthesisAnalysis,
  SiteEstimate,
} from "../types/evidenceSynthesis";
import {
  useCreateEvidenceSynthesis,
  useUpdateEvidenceSynthesis,
} from "../hooks/useEvidenceSynthesis";

const defaultEstimate: SiteEstimate = {
  logRr: 0,
  seLogRr: 0.1,
  siteName: "",
};

const defaultDesign: EvidenceSynthesisDesign = {
  estimates: [
    { logRr: -0.3, seLogRr: 0.15, siteName: "Site A" },
    { logRr: -0.1, seLogRr: 0.2, siteName: "Site B" },
  ],
  method: "bayesian",
};

interface EvidenceSynthesisDesignerProps {
  analysis?: EvidenceSynthesisAnalysis | null;
  isNew?: boolean;
  onSaved?: (a: EvidenceSynthesisAnalysis) => void;
}

export function EvidenceSynthesisDesigner({
  analysis,
  isNew,
  onSaved,
}: EvidenceSynthesisDesignerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<EvidenceSynthesisDesign>(defaultDesign);

  const createMutation = useCreateEvidenceSynthesis();
  const updateMutation = useUpdateEvidenceSynthesis();

  useEffect(() => {
    if (analysis) {
      setName(analysis.name ?? "");
      setDescription(analysis.description ?? "");
      setDesign(analysis.design_json ?? defaultDesign);
    }
  }, [analysis]);

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !analysis) {
      createMutation.mutate(
        { name: name.trim(), description: description.trim() || undefined, design_json: design },
        { onSuccess: (a) => onSaved?.(a) },
      );
    } else {
      updateMutation.mutate(
        { id: analysis.id, payload: { name: name.trim(), description: description.trim(), design_json: design } },
        { onSuccess: (a) => onSaved?.(a) },
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const addEstimate = () => {
    setDesign((d) => ({
      ...d,
      estimates: [...d.estimates, { ...defaultEstimate, siteName: `Site ${d.estimates.length + 1}` }],
    }));
  };

  const removeEstimate = (idx: number) => {
    setDesign((d) => ({
      ...d,
      estimates: d.estimates.filter((_, i) => i !== idx),
    }));
  };

  const updateEstimate = (idx: number, updates: Partial<SiteEstimate>) => {
    setDesign((d) => ({
      ...d,
      estimates: d.estimates.map((e, i) => (i === idx ? { ...e, ...updates } : e)),
    }));
  };

  const inputCls = cn(
    "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
    "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
  );

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Basic Information</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Evidence synthesis name"
              className={cn(inputCls, "placeholder:text-text-ghost")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className={cn(inputCls, "placeholder:text-text-ghost resize-none")}
            />
          </div>
        </div>
      </div>

      {/* Method */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Meta-Analysis Method</h3>
        <select
          value={design?.method ?? "bayesian"}
          onChange={(e) => setDesign((d) => ({ ...d, method: e.target.value as "bayesian" | "fixed" }))}
          className={inputCls}
        >
          <option value="bayesian">Bayesian Random-Effects</option>
          <option value="fixed">Fixed-Effect (Inverse Variance)</option>
        </select>

        {(design?.method ?? "bayesian") === "bayesian" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-[10px] text-text-ghost mb-1">Chain Length</label>
              <input
                type="number"
                value={design.chainLength ?? 1100000}
                onChange={(e) => setDesign((d) => ({ ...d, chainLength: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-ghost mb-1">Burn-in</label>
              <input
                type="number"
                value={design.burnIn ?? 100000}
                onChange={(e) => setDesign((d) => ({ ...d, burnIn: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-ghost mb-1">Sub-sample</label>
              <input
                type="number"
                value={design.subSample ?? 100}
                onChange={(e) => setDesign((d) => ({ ...d, subSample: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      {/* Site Estimates */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Site Estimates</h3>
          <button
            type="button"
            onClick={addEstimate}
            className="inline-flex items-center gap-1 text-xs text-success hover:text-[#26B8A5] transition-colors"
          >
            <Plus size={12} /> Add Site
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Enter log(RR) and SE(log RR) from each site/database. Minimum 2 sites.
        </p>

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_120px_32px] gap-2 px-1">
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Site Name</span>
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Log(RR)</span>
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">SE(Log RR)</span>
            <span />
          </div>

          {(design?.estimates ?? []).map((est, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_120px_120px_32px] gap-2 items-center">
              <input
                type="text"
                value={est.siteName}
                onChange={(e) => updateEstimate(idx, { siteName: e.target.value })}
                placeholder={`Site ${idx + 1}`}
                className={cn(inputCls, "placeholder:text-text-ghost")}
              />
              <input
                type="number"
                step="0.01"
                value={est.logRr}
                onChange={(e) => updateEstimate(idx, { logRr: Number(e.target.value) })}
                className={inputCls}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={est.seLogRr}
                onChange={(e) => updateEstimate(idx, { seLogRr: Number(e.target.value) })}
                className={inputCls}
              />
              {(design?.estimates?.length ?? 0) > 2 ? (
                <button
                  type="button"
                  onClick={() => removeEstimate(idx)}
                  className="text-text-muted hover:text-critical transition-colors flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>

        {/* Preview HRs */}
        <div className="mt-3 pt-3 border-t border-border-default">
          <p className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold mb-2">
            HR Preview (exp(logRR))
          </p>
          <div className="flex flex-wrap gap-2">
            {(design?.estimates ?? []).map((est, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-text-secondary"
              >
                {est.siteName || `Site ${idx + 1}`}: {Math.exp(est.logRr).toFixed(3)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !(name ?? "").trim() || (design?.estimates?.length ?? 0) < 2}
          className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-surface-base hover:bg-success transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isNew ? "Create" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
