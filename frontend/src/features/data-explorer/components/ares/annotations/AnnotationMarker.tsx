import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAnnotations } from "../../../hooks/useAnnotationData";

interface AnnotationMarkerProps {
  sourceId: number;
  chartType: string;
  xValues: string[];
}

export function AnnotationMarker({ sourceId, chartType, xValues }: AnnotationMarkerProps) {
  const [hoveredX, setHoveredX] = useState<string | null>(null);
  const { data: annotations } = useAnnotations(sourceId, chartType);

  if (!annotations || annotations.length === 0) return null;

  // Index annotations by x_value for quick lookup
  const annotationsByX = new Map<string, typeof annotations>();
  for (const ann of annotations) {
    const existing = annotationsByX.get(ann.x_value) ?? [];
    existing.push(ann);
    annotationsByX.set(ann.x_value, existing);
  }

  // Only show markers for x values that have annotations
  const markedValues = xValues.filter((x) => annotationsByX.has(x));
  if (markedValues.length === 0) return null;

  return (
    <div className="relative">
      {markedValues.map((xVal) => {
        const xAnnotations = annotationsByX.get(xVal) ?? [];
        return (
          <div
            key={xVal}
            className="inline-block relative mr-2"
            onMouseEnter={() => setHoveredX(xVal)}
            onMouseLeave={() => setHoveredX(null)}
          >
            <div className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent cursor-pointer">
              <MessageSquare size={10} />
              <span>{xVal}</span>
              {xAnnotations.length > 1 && (
                <span className="text-[10px]">({xAnnotations.length})</span>
              )}
            </div>

            {hoveredX === xVal && (
              <div className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-lg border border-[#252530] bg-surface-raised p-2 shadow-xl">
                {xAnnotations.map((ann) => (
                  <div key={ann.id} className="border-b border-[#252530] py-1.5 last:border-0">
                    <p className="text-xs text-text-primary">{ann.annotation_text}</p>
                    {ann.creator && (
                      <p className="text-[10px] text-text-muted mt-0.5">{ann.creator.name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
