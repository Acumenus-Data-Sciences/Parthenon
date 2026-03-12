import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useTimePeriods } from "../hooks/useGis";

interface TimeSliderProps {
  value: string | null;
  onChange: (period: string | null) => void;
  conceptId: number | null;
}

export function TimeSlider({ value, onChange, conceptId }: TimeSliderProps) {
  const { data: periods } = useTimePeriods(conceptId);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentIndex = periods && value ? periods.indexOf(value) : -1;

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!periods || periods.length === 0) return;
      const next = currentIndex + dir;
      if (next >= 0 && next < periods.length) {
        onChange(periods[next]);
      } else if (dir === 1) {
        onChange(periods[0]);
      }
    },
    [periods, currentIndex, onChange]
  );

  useEffect(() => {
    if (playing && periods && periods.length > 0) {
      intervalRef.current = setInterval(() => step(1), 800);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, step, periods]);

  if (!periods || periods.length === 0) return null;

  const formatPeriod = (p: string) => {
    const [y, m] = p.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="space-y-2 rounded-lg border border-[#232328] bg-[#18181B] p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
          Timeline
        </span>
        <span className="text-sm font-medium text-[#C9A227]">
          {value ? formatPeriod(value) : "All time"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => { onChange(null); setPlaying(false); }}
          className="rounded p-1 text-[#5A5650] hover:text-[#E8E4DC]"
          title="Reset to all-time"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => setPlaying(!playing)}
          className="rounded p-1 text-[#C9A227] hover:text-[#E8E4DC]"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <input
          type="range"
          min={0}
          max={periods.length - 1}
          value={currentIndex >= 0 ? currentIndex : 0}
          onChange={(e) => onChange(periods[parseInt(e.target.value)])}
          className="flex-1 accent-[#C9A227]"
        />

        <button
          onClick={() => step(1)}
          className="rounded p-1 text-[#5A5650] hover:text-[#E8E4DC]"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex justify-between text-[10px] text-[#5A5650]">
        <span>{formatPeriod(periods[0])}</span>
        <span>{formatPeriod(periods[periods.length - 1])}</span>
      </div>
    </div>
  );
}
