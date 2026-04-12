import { useState, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { useSimilarityDimensions } from '../hooks/usePatientSimilarity';
import type { SimilarityDimension } from '../types/patientSimilarity';

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
  ageMin: number;
  ageMax: number;
  onAgeMinChange: (v: number) => void;
  onAgeMaxChange: (v: number) => void;
  gender: string;
  onGenderChange: (v: string) => void;
  onApply: () => void;
}

// ── Inner form — only mounted while drawer is open so useState re-initializes each open ──

interface SettingsFormProps extends SettingsDrawerProps {
  dimensions: SimilarityDimension[];
}

function SettingsForm({
  onClose,
  weights,
  onWeightsChange,
  ageMin,
  ageMax,
  onAgeMinChange,
  onAgeMaxChange,
  gender,
  onGenderChange,
  onApply,
  dimensions,
}: SettingsFormProps) {
  // Initialize from merged defaults on every mount (i.e., every drawer open)
  const initialWeights = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const dim of dimensions) {
      merged[dim.key] = weights[dim.key] ?? dim.default_weight;
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — snapshot on mount only

  const [localWeights, setLocalWeights] = useState<Record<string, number>>(initialWeights);

  function handleWeightChange(key: string, value: number) {
    setLocalWeights((prev) => ({ ...prev, [key]: value }));
  }

  function handleResetDefaults() {
    const defaults: Record<string, number> = {};
    for (const dim of dimensions) {
      defaults[dim.key] = dim.default_weight;
    }
    setLocalWeights(defaults);
  }

  function handleApply() {
    onWeightsChange(localWeights);
    onApply();
    onClose();
  }

  function weightColor(v: number): string {
    if (v === 0) return 'text-[#5A5650]';
    if (v <= 2.5) return 'text-[#2DD4BF]';
    return 'text-[#C9A227]';
  }

  const footer = (
    <button
      type="button"
      onClick={handleApply}
      className="w-full rounded-md bg-[#9B1B30] px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-[#7d1526] focus:outline-none focus:ring-2 focus:ring-[#9B1B30] focus:ring-offset-2 focus:ring-offset-[#1A1A1F]"
    >
      Apply &amp; Re-run Pipeline
    </button>
  );

  return (
    <Drawer open onClose={onClose} title="Analysis Settings" size="md" footer={footer}>
      <div className="space-y-8">
        {/* ── Dimension Weights ──────────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#C9A227]">
              Dimension Weights
            </h3>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#5A5650] transition-colors hover:text-[#C9A227]"
            >
              <RotateCcw size={12} />
              Reset defaults
            </button>
          </div>

          {dimensions.length === 0 && (
            <p className="text-sm text-[#5A5650]">Loading dimensions…</p>
          )}

          <div className="space-y-4">
            {dimensions.map((dim) => {
              const val = localWeights[dim.key] ?? dim.default_weight;
              return (
                <div key={dim.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor={`weight-${dim.key}`} className="text-sm text-[#B0A898]">
                      {dim.name}
                    </label>
                    <span className={`font-mono text-sm font-semibold ${weightColor(val)}`}>
                      {val.toFixed(1)}
                    </span>
                  </div>
                  <input
                    id={`weight-${dim.key}`}
                    type="range"
                    min={0}
                    max={5}
                    step={0.5}
                    value={val}
                    onChange={(e) => handleWeightChange(dim.key, parseFloat(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2A2A2F] accent-[#C9A227]"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Demographic Filters ────────────────────────────────── */}
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#C9A227]">
            Demographic Filters
          </h3>

          <div className="space-y-4">
            {/* Age range */}
            <div>
              <p className="mb-2 text-sm text-[#B0A898]">Age Range</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label htmlFor="age-min" className="mb-1 block text-xs text-[#5A5650]">
                    Min
                  </label>
                  <input
                    id="age-min"
                    type="number"
                    min={0}
                    max={ageMax}
                    value={ageMin}
                    onChange={(e) =>
                      onAgeMinChange(Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-full rounded border border-[#2A2A2F] bg-[#16161A] px-3 py-1.5 text-sm text-[#E8E3DC] focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <span className="mt-4 text-[#5A5650]">—</span>
                <div className="flex-1">
                  <label htmlFor="age-max" className="mb-1 block text-xs text-[#5A5650]">
                    Max
                  </label>
                  <input
                    id="age-max"
                    type="number"
                    min={ageMin}
                    max={150}
                    value={ageMax}
                    onChange={(e) =>
                      onAgeMaxChange(Math.min(150, parseInt(e.target.value, 10) || 150))
                    }
                    className="w-full rounded border border-[#2A2A2F] bg-[#16161A] px-3 py-1.5 text-sm text-[#E8E3DC] focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="gender-select" className="mb-1 block text-sm text-[#B0A898]">
                Gender
              </label>
              <select
                id="gender-select"
                value={gender}
                onChange={(e) => onGenderChange(e.target.value)}
                className="w-full rounded border border-[#2A2A2F] bg-[#16161A] px-3 py-1.5 text-sm text-[#E8E3DC] focus:border-[#C9A227] focus:outline-none"
              >
                <option value="">All</option>
                <option value="8507">Male</option>
                <option value="8532">Female</option>
              </select>
            </div>
          </div>
        </section>
      </div>
    </Drawer>
  );
}

// ── Public export — mounts SettingsForm only while open so state resets each open ──

export function SettingsDrawer(props: SettingsDrawerProps) {
  const { data: dimensions = [] } = useSimilarityDimensions();

  if (!props.open) return null;

  return <SettingsForm {...props} dimensions={dimensions} />;
}
