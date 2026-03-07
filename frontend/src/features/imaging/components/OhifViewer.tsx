/**
 * OhifViewer — Embeds the OHIF Viewer via iframe, pointed at a specific study.
 *
 * OHIF is served as static files at /ohif/ by nginx. It reads DICOMweb data
 * from Orthanc (proxied at /orthanc/). The study is selected via URL parameter.
 */

import { useState, useRef, useLayoutEffect } from "react";
import { Loader2, ExternalLink, AlertCircle } from "lucide-react";

interface OhifViewerProps {
  studyInstanceUid: string;
  className?: string;
}

export default function OhifViewer({ studyInstanceUid, className = "" }: OhifViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(600);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fill available vertical space
  useLayoutEffect(() => {
    function recalc() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const available = window.innerHeight - rect.top - 24;
      setHeight(Math.max(400, available));
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  const ohifUrl = `/ohif/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`;

  return (
    <div ref={containerRef} className={`relative rounded-lg border border-[#1E1E23] overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0E0E11]">
          <div className="flex flex-col items-center gap-3 text-[#8A857D]">
            <Loader2 size={28} className="animate-spin text-[#2DD4BF]" />
            <p className="text-sm">Loading OHIF Viewer…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0E0E11]">
          <div className="flex flex-col items-center gap-3 text-[#E85A6B]">
            <AlertCircle size={28} />
            <p className="text-sm">Failed to load OHIF Viewer</p>
            <a
              href={ohifUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#2DD4BF] hover:underline"
            >
              Open in new tab <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      <iframe
        src={ohifUrl}
        title="OHIF DICOM Viewer"
        style={{ width: "100%", height, border: "none" }}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
        allow="fullscreen"
      />

      {/* Open in new tab link */}
      {!loading && !error && (
        <div className="absolute top-2 right-2 z-10">
          <a
            href={ohifUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-[#0E0E11]/80 px-2 py-1 text-[10px] text-[#5A5650] hover:text-[#8A857D] transition-colors backdrop-blur-sm"
            title="Open OHIF in new tab"
          >
            <ExternalLink size={10} />
            Expand
          </a>
        </div>
      )}
    </div>
  );
}
