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

/**
 * A pencil-sketch White Rabbit running in place.
 * Homage to the OHDSI WhiteRabbit database profiling tool.
 * Uses CSS keyframe animation to cycle through 4 run poses via clip-path.
 */
function RunningRabbit() {
  return (
    <div className="relative w-32 h-24 overflow-hidden">
      <svg
        viewBox="0 0 512 384"
        className="w-full h-full animate-rabbit-run"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Pencil-sketch style strokes */}
        <g
          stroke="#e0e0e0"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {/* Body - oval torso */}
          <ellipse cx="256" cy="200" rx="80" ry="55" strokeWidth="2.5" />
          {/* Fluffy chest tuft */}
          <path d="M195 185 Q185 200 195 215" strokeWidth="1.5" />
          <path d="M200 180 Q188 200 200 220" strokeWidth="1.5" />

          {/* Head */}
          <ellipse cx="185" cy="155" rx="38" ry="32" strokeWidth="2.5" />
          {/* Cheek fluff */}
          <path d="M210 160 Q220 165 215 172" strokeWidth="1.5" />

          {/* Eye */}
          <circle cx="172" cy="148" r="5" fill="#e0e0e0" stroke="none" />
          <circle cx="173" cy="147" r="2" fill="#0E0E11" stroke="none" />
          {/* Eyebrow sketch line */}
          <path d="M165 139 Q172 135 180 138" strokeWidth="1.5" />

          {/* Nose */}
          <ellipse cx="152" cy="155" rx="4" ry="3" fill="#f0a0a0" stroke="#d08080" strokeWidth="1" />

          {/* Whiskers */}
          <line x1="140" y1="152" x2="115" y2="145" strokeWidth="1" opacity="0.6" />
          <line x1="140" y1="156" x2="112" y2="156" strokeWidth="1" opacity="0.6" />
          <line x1="140" y1="160" x2="115" y2="167" strokeWidth="1" opacity="0.6" />

          {/* Mouth */}
          <path d="M155 162 Q160 168 167 164" strokeWidth="1.5" />

          {/* Left ear (long, upright) */}
          <path d="M175 125 Q168 70 178 55 Q188 50 195 65 Q200 85 195 125" strokeWidth="2.5" />
          {/* Inner ear */}
          <path d="M180 115 Q177 80 183 65 Q189 62 192 72 Q195 90 192 115" strokeWidth="1" fill="#f5c0c0" opacity="0.3" />

          {/* Right ear (slightly tilted back) */}
          <path d="M195 120 Q200 65 210 48 Q220 44 224 58 Q225 80 215 120" strokeWidth="2.5" />
          {/* Inner ear */}
          <path d="M202 112 Q205 72 213 58 Q218 55 220 65 Q220 85 213 112" strokeWidth="1" fill="#f5c0c0" opacity="0.3" />

          {/* Tail (fluffy pom) */}
          <circle cx="340" cy="190" r="14" strokeWidth="2" />
          <path d="M332 182 Q340 178 348 182" strokeWidth="1" />
          <path d="M330 190 Q340 185 350 190" strokeWidth="1" />
          <path d="M332 198 Q340 195 348 198" strokeWidth="1" />
        </g>

        {/* Front legs - animated via CSS class swap */}
        <g
          className="rabbit-legs-front"
          stroke="#e0e0e0"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        >
          {/* Front left leg */}
          <path className="leg-fl" d="M215 240 Q205 275 195 310 Q192 320 200 322" />
          {/* Front right leg */}
          <path className="leg-fr" d="M230 242 Q240 278 250 310 Q253 320 245 322" />
          {/* Paw sketches */}
          <ellipse className="paw-fl" cx="198" cy="322" rx="8" ry="4" />
          <ellipse className="paw-fr" cx="247" cy="322" rx="8" ry="4" />
        </g>

        {/* Back legs - animated */}
        <g
          className="rabbit-legs-back"
          stroke="#e0e0e0"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        >
          {/* Haunch */}
          <path d="M300 210 Q320 230 315 250" strokeWidth="2" />
          {/* Back left leg */}
          <path className="leg-bl" d="M300 245 Q285 280 275 310 Q272 322 280 324" />
          {/* Back right leg */}
          <path className="leg-br" d="M315 248 Q325 285 320 310 Q318 322 326 324" />
          {/* Paw sketches */}
          <ellipse className="paw-bl" cx="278" cy="324" rx="10" ry="4" />
          <ellipse className="paw-br" cx="324" cy="324" rx="10" ry="4" />
        </g>

        {/* Ground line - sketchy */}
        <g stroke="#e0e0e0" strokeWidth="1" opacity="0.3">
          <line x1="80" y1="328" x2="430" y2="328" strokeDasharray="8 6" />
        </g>

        {/* Motion lines behind rabbit */}
        <g stroke="#e0e0e0" strokeWidth="1" opacity="0.15" className="motion-lines">
          <line x1="370" y1="175" x2="420" y2="175" />
          <line x1="375" y1="195" x2="435" y2="195" />
          <line x1="370" y1="215" x2="425" y2="215" />
        </g>
      </svg>
    </div>
  );
}

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
        {/* Running White Rabbit */}
        <RunningRabbit />

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

      {/* Running animation keyframes */}
      <style>{`
        @keyframes rabbit-bob {
          0%, 100% { transform: translateY(0px); }
          25% { transform: translateY(-4px); }
          75% { transform: translateY(2px); }
        }

        @keyframes leg-front-left {
          0%   { d: path("M215 240 Q205 275 195 310 Q192 320 200 322"); }
          25%  { d: path("M215 240 Q195 265 180 295 Q175 308 183 312"); }
          50%  { d: path("M215 240 Q205 275 195 310 Q192 320 200 322"); }
          75%  { d: path("M215 240 Q220 270 225 300 Q228 312 220 315"); }
          100% { d: path("M215 240 Q205 275 195 310 Q192 320 200 322"); }
        }

        @keyframes leg-front-right {
          0%   { d: path("M230 242 Q240 278 250 310 Q253 320 245 322"); }
          25%  { d: path("M230 242 Q245 270 255 298 Q258 310 250 313"); }
          50%  { d: path("M230 242 Q240 278 250 310 Q253 320 245 322"); }
          75%  { d: path("M230 242 Q218 268 210 298 Q207 310 215 313"); }
          100% { d: path("M230 242 Q240 278 250 310 Q253 320 245 322"); }
        }

        @keyframes leg-back-left {
          0%   { d: path("M300 245 Q285 280 275 310 Q272 322 280 324"); }
          25%  { d: path("M300 245 Q310 275 315 305 Q318 318 310 320"); }
          50%  { d: path("M300 245 Q285 280 275 310 Q272 322 280 324"); }
          75%  { d: path("M300 245 Q275 272 260 300 Q255 314 263 316"); }
          100% { d: path("M300 245 Q285 280 275 310 Q272 322 280 324"); }
        }

        @keyframes leg-back-right {
          0%   { d: path("M315 248 Q325 285 320 310 Q318 322 326 324"); }
          25%  { d: path("M315 248 Q298 275 288 305 Q285 318 293 320"); }
          50%  { d: path("M315 248 Q325 285 320 310 Q318 322 326 324"); }
          75%  { d: path("M315 248 Q335 278 340 305 Q343 318 335 320"); }
          100% { d: path("M315 248 Q325 285 320 310 Q318 322 326 324"); }
        }

        @keyframes motion-dash {
          0%   { stroke-dashoffset: 0; opacity: 0.15; }
          50%  { stroke-dashoffset: -20; opacity: 0.3; }
          100% { stroke-dashoffset: -40; opacity: 0.15; }
        }

        .animate-rabbit-run {
          animation: rabbit-bob 0.4s ease-in-out infinite;
        }

        .leg-fl { animation: leg-front-left 0.4s ease-in-out infinite; }
        .leg-fr { animation: leg-front-right 0.4s ease-in-out infinite 0.2s; }
        .leg-bl { animation: leg-back-left 0.4s ease-in-out infinite 0.1s; }
        .leg-br { animation: leg-back-right 0.4s ease-in-out infinite 0.3s; }

        .paw-fl { animation: leg-front-left 0.4s ease-in-out infinite; }
        .paw-fr { animation: leg-front-right 0.4s ease-in-out infinite 0.2s; }
        .paw-bl { animation: leg-back-left 0.4s ease-in-out infinite 0.1s; }
        .paw-br { animation: leg-back-right 0.4s ease-in-out infinite 0.3s; }

        .motion-lines line {
          stroke-dasharray: 8 6;
          animation: motion-dash 0.6s linear infinite;
        }
      `}</style>
    </div>
  );
}
