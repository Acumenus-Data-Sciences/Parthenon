import { useState } from "react";
import type { TemporalWindow } from "../../types/cohortExpression";
import {
  getTemporalPresets,
  buildCustomWindow,
  describeWindow,
  coeffToDirection,
  type TemporalPreset,
  type TemporalDirection,
} from "../../utils/temporalPresets";
import { useTranslation } from "react-i18next";

interface TemporalPresetPickerProps {
  value: TemporalWindow | null;
  onChange: (window: TemporalWindow | null) => void;
}

export function TemporalPresetPicker({ value, onChange }: TemporalPresetPickerProps) {
  const { t } = useTranslation("app");
  const temporalPresets = getTemporalPresets();
  const [isCustom, setIsCustom] = useState(false);
  const [startDays, setStartDays] = useState(value?.Start?.Days ?? 30);
  const [startDir, setStartDir] = useState<TemporalDirection>(
    value?.Start ? coeffToDirection(value.Start.Coeff) : "before",
  );
  const [endDays, setEndDays] = useState(value?.End?.Days ?? 30);
  const [endDir, setEndDir] = useState<TemporalDirection>(
    value?.End ? coeffToDirection(value.End.Coeff) : "after",
  );

  const handlePreset = (preset: TemporalPreset) => {
    setIsCustom(false);
    onChange(preset.window);
    if (preset.window) {
      setStartDays(preset.window.Start.Days);
      setStartDir(coeffToDirection(preset.window.Start.Coeff));
      setEndDays(preset.window.End.Days);
      setEndDir(coeffToDirection(preset.window.End.Coeff));
    }
  };

  const handleCustomChange = (
    sd: number,
    sDir: TemporalDirection,
    ed: number,
    eDir: TemporalDirection,
  ) => {
    setStartDays(sd);
    setStartDir(sDir);
    setEndDays(ed);
    setEndDir(eDir);
    onChange(buildCustomWindow(sd, sDir, ed, eDir));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Presets */}
      <div className="grid grid-cols-3 gap-2">
        {temporalPresets.map((preset) => {
          const isSelected =
            !isCustom &&
            JSON.stringify(value) === JSON.stringify(preset.window);
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePreset(preset)}
              className={`rounded-md p-2.5 text-left transition-colors ${
                isSelected
                  ? "border border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
                  : "border border-border-default bg-surface-base hover:border-border-default"
              }`}
            >
              <div className={`text-[13px] font-medium ${isSelected ? "text-success" : "text-text-secondary"}`}>
                {preset.label}
              </div>
              <div className="text-[11px] text-text-ghost">{preset.description}</div>
            </button>
          );
        })}
      </div>

      {/* Custom toggle */}
      <button
        type="button"
        onClick={() => {
          setIsCustom(true);
          handleCustomChange(startDays, startDir, endDays, endDir);
        }}
        className={`text-[12px] ${isCustom ? "text-accent" : "text-text-ghost hover:text-text-muted"}`}
      >
        {isCustom ? "▾ Custom range" : "▸ Custom range..."}
      </button>

      {/* Custom range inputs */}
      {isCustom && (
        <div className="rounded-md bg-surface-overlay p-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="text-text-secondary">between</span>
            <input
              type="number"
              min={0}
              value={startDays}
              onChange={(e) =>
                handleCustomChange(Math.max(0, parseInt(e.target.value) || 0), startDir, endDays, endDir)
              }
              className="w-[50px] rounded border border-border-default bg-surface-base px-2 py-1 text-center text-accent outline-none focus:border-accent"
            />
            <span className="text-text-secondary">days</span>
            <select
              value={startDir}
              onChange={(e) =>
                handleCustomChange(startDays, e.target.value as TemporalDirection, endDays, endDir)
              }
              className="rounded border border-border-default bg-surface-base px-2 py-1 text-success outline-none"
            >
              <option value="before">before</option>
              <option value="after">after</option>
            </select>
            <span className="text-text-secondary">and</span>
            <input
              type="number"
              min={0}
              value={endDays}
              onChange={(e) =>
                handleCustomChange(startDays, startDir, Math.max(0, parseInt(e.target.value) || 0), endDir)
              }
              className="w-[50px] rounded border border-border-default bg-surface-base px-2 py-1 text-center text-accent outline-none focus:border-accent"
            />
            <span className="text-text-secondary">days</span>
            <select
              value={endDir}
              onChange={(e) =>
                handleCustomChange(startDays, startDir, endDays, e.target.value as TemporalDirection)
              }
              className="rounded border border-border-default bg-surface-base px-2 py-1 text-success outline-none"
            >
              <option value="before">before</option>
              <option value="after">after</option>
            </select>
            <span className="text-text-secondary">{t("cohortDefinitions.auto.cohortEntry_9aa430")}</span>
          </div>
        </div>
      )}

      {/* Live preview */}
      {value !== undefined && (
        <div className="rounded-md border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] px-3 py-2">
          <span className="text-[11px] text-text-ghost">{t("cohortDefinitions.auto.readsAs_531e4b")} </span>
          <span className="text-[13px] text-text-secondary">
            {t("cohortDefinitions.auto.text_c309d0")}{describeWindow(value)}{t("cohortDefinitions.auto.text_4849a7")}
          </span>
        </div>
      )}
    </div>
  );
}
