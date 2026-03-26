import { useState, useEffect, useCallback } from 'react';

interface ScanProgressIndicatorProps {
  isScanning: boolean;
  onCancel: () => void;
}

const PHASES = [
  'Connecting to database...',
  'Scanning tables...',
  'Profiling columns...',
  'Computing quality metrics...',
] as const;

const PHASE_THRESHOLDS_MS = [0, 2000, 5000] as const;
const LONG_RUNNING_THRESHOLD_S = 60;

export default function ScanProgressIndicator({
  isScanning,
  onCancel,
}: ScanProgressIndicatorProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [wasScanningRef, setWasScanningRef] = useState(false);

  // Reset state when scanning starts
  useEffect(() => {
    if (isScanning) {
      setPhaseIndex(0);
      setElapsedSeconds(0);
      setWasScanningRef(true);
    } else if (wasScanningRef) {
      // Scanning just finished — show final phase
      setPhaseIndex(3);
    }
  }, [isScanning, wasScanningRef]);

  // Elapsed time counter
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isScanning]);

  // Phase transitions based on elapsed time
  useEffect(() => {
    if (!isScanning) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 2 at 2s
    timers.push(
      setTimeout(() => setPhaseIndex(1), PHASE_THRESHOLDS_MS[1]),
    );

    // Phase 3 at 5s
    timers.push(
      setTimeout(() => setPhaseIndex(2), PHASE_THRESHOLDS_MS[2]),
    );

    return () => timers.forEach(clearTimeout);
  }, [isScanning]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  // Don't render if not scanning and never was (or already done)
  if (!isScanning && !wasScanningRef) return null;
  // Hide after final phase has been shown briefly
  if (!isScanning && phaseIndex !== 3) return null;

  const showLongRunningMessage = elapsedSeconds >= LONG_RUNNING_THRESHOLD_S;

  return (
    <div className="bg-[#0E0E11]/90 backdrop-blur-sm rounded-xl border border-[#2a2a3e] p-8">
      <div className="flex flex-col items-center gap-4">
        {/* Running White Rabbit — homage to OHDSI WhiteRabbit */}
        <img
          src="/whiterabbit.gif"
          alt="White Rabbit scanning"
          className="w-80 h-auto"
        />

        {/* Phase text */}
        <p className="text-lg text-white font-medium">
          {PHASES[phaseIndex]}
        </p>

        {/* Elapsed time */}
        <p className="text-sm text-gray-400">
          {elapsedSeconds}s elapsed
        </p>

        {/* Long-running message */}
        {showLongRunningMessage && (
          <p className="text-sm text-amber-400/70">
            Large databases may take several minutes
          </p>
        )}

        {/* Cancel button */}
        {isScanning && (
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm text-gray-400 hover:text-white border border-gray-600 rounded px-4 py-1.5 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
