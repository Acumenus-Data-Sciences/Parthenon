/**
 * OhifViewer — Embeds the OHIF Viewer via iframe, pointed at a specific study.
 *
 * OHIF is served as static files at /ohif/ by nginx. It reads DICOMweb data
 * from Orthanc (proxied at /orthanc/). The study is selected via URL parameter.
 *
 * Measurement Bridge: OHIF posts measurement events via postMessage (injected
 * via ohif-bridge.js). This component listens and saves them to Parthenon's
 * imaging measurement API.
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { Loader2, ExternalLink, AlertCircle, Save, CheckCircle2 } from "lucide-react";
import { imagingApi } from "../api/imagingApi";

interface OhifMeasurementPayload {
  uid: string;
  StudyInstanceUID?: string;
  SeriesInstanceUID?: string;
  SOPInstanceUID?: string;
  label?: string;
  type?: string;
  displayText?: string[];
  length?: number | null;
  area?: number | null;
  longestDiameter?: number | null;
  shortestDiameter?: number | null;
  mean?: number | null;
  stdDev?: number | null;
  min?: number | null;
  max?: number | null;
  unit?: string;
}

interface PendingMeasurement {
  uid: string;
  payload: OhifMeasurementPayload;
}

interface OhifViewerProps {
  studyInstanceUid: string;
  seriesInstanceUids?: string[];
  studyId?: number;
  personId?: number | null;
  className?: string;
  onMeasurementSaved?: () => void;
}

export default function OhifViewer({
  studyInstanceUid,
  seriesInstanceUids = [],
  studyId,
  className = "",
  onMeasurementSaved,
}: OhifViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [pending, setPending] = useState<PendingMeasurement[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // Fill available vertical space — recalc on mount, resize, and after iframe loads
  const recalcHeight = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const available = window.innerHeight - rect.top - 24;
    setHeight(Math.max(600, available));
  }, []);

  useLayoutEffect(() => {
    recalcHeight();
    window.addEventListener("resize", recalcHeight);
    return () => window.removeEventListener("resize", recalcHeight);
  }, [recalcHeight]);

  // Listen for measurement events from OHIF bridge
  useEffect(() => {
    if (!studyId) return;

    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data?.type?.startsWith("ohif:")) return;

      if (data.type === "ohif:bridge:ready") {
        setBridgeReady(true);
        return;
      }

      if (data.type === "ohif:measurement:added" || data.type === "ohif:measurement:updated") {
        const p = data.payload as OhifMeasurementPayload;
        setPending((prev) => {
          const idx = prev.findIndex((m) => m.uid === p.uid);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { uid: p.uid, payload: p };
            return updated;
          }
          return [...prev, { uid: p.uid, payload: p }];
        });
      }

      if (data.type === "ohif:measurement:removed") {
        const uid = data.payload?.measurementId;
        if (uid) setPending((prev) => prev.filter((m) => m.uid !== uid));
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [studyId]);

  // Save all pending measurements to Parthenon
  const saveAllPending = useCallback(async () => {
    if (!studyId || pending.length === 0) return;
    setSaving(true);

    let count = 0;
    for (const m of pending) {
      const p = m.payload;

      // Determine measurement type and value from OHIF data
      let measurementType = "longest_diameter";
      let value = 0;
      let unit = p.unit || "mm";
      let name = p.label || p.type || "OHIF Measurement";

      if (p.length != null) {
        measurementType = "longest_diameter";
        value = p.length;
        name = p.label || "Length";
      } else if (p.longestDiameter != null) {
        measurementType = "longest_diameter";
        value = p.longestDiameter;
        name = p.label || "Bidimensional";
      } else if (p.area != null) {
        measurementType = "tumor_volume";
        value = p.area;
        unit = "mm2";
        name = p.label || "Area";
      } else if (p.mean != null) {
        measurementType = "density_hu";
        value = p.mean;
        unit = "HU";
        name = p.label || "ROI Mean";
      }

      try {
        await imagingApi.createMeasurement(studyId, {
          measurement_type: measurementType,
          measurement_name: `[OHIF] ${name}`,
          value_as_number: Math.round(value * 100) / 100,
          unit,
          algorithm_name: "ohif-viewer",
          confidence: 1.0,
        });
        count++;
      } catch {
        // Individual measurement save failed — continue with rest
      }
    }

    setPending([]);
    setSavedCount((c) => c + count);
    setSaving(false);
    if (count > 0) onMeasurementSaved?.();
  }, [studyId, pending, onMeasurementSaved]);

  const scopedSeriesInstanceUids = useMemo(
    () => Array.from(new Set(seriesInstanceUids.filter(Boolean))),
    [seriesInstanceUids],
  );

  const buildOhifUrl = useCallback(
    (hangingProtocolId?: string) => {
      const params = new URLSearchParams();
      params.set("StudyInstanceUIDs", studyInstanceUid);

      if (scopedSeriesInstanceUids.length > 0) {
        params.set("SeriesInstanceUIDs", scopedSeriesInstanceUids.join(","));
      }

      if (hangingProtocolId) {
        params.set("hangingProtocolId", hangingProtocolId);
      }

      return `/ohif/viewer?${params.toString()}`;
    },
    [scopedSeriesInstanceUids, studyInstanceUid],
  );

  const ohifUrl = buildOhifUrl();
  const ohifMprUrl = buildOhifUrl("mpr");
  const ohif3dUrl = buildOhifUrl("mprAnd3DVolumeViewport");

  return (
    <div ref={containerRef} className={`relative rounded-lg border border-border-subtle overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-base">
          <div className="flex flex-col items-center gap-3 text-text-muted">
            <Loader2 size={28} className="animate-spin text-success" />
            <p className="text-sm">Loading OHIF Viewer…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-base">
          <div className="flex flex-col items-center gap-3 text-critical">
            <AlertCircle size={28} />
            <p className="text-sm">Failed to load OHIF Viewer</p>
            <a
              href={ohifUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-success hover:underline"
            >
              Open in new tab <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={ohifUrl}
        title="OHIF DICOM Viewer"
        style={{ width: "100%", height, border: "none" }}
        onLoad={() => {
          setLoading(false);
          recalcHeight();
          // OHIF's Cornerstone viewports need a resize event after the iframe
          // finishes layout — without this, viewports get stuck at size 0.
          const iframe = iframeRef.current;
          if (iframe?.contentWindow) {
            const triggerResize = () => {
              try { iframe.contentWindow?.dispatchEvent(new Event("resize")); } catch { /* cross-origin */ }
            };
            setTimeout(triggerResize, 500);
            setTimeout(triggerResize, 1500);
            setTimeout(triggerResize, 3000);
          }
        }}
        onError={() => { setLoading(false); setError(true); }}
        allow="fullscreen"
      />

      {/* Top-right controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {/* Pending measurement save button */}
        {pending.length > 0 && studyId && (
          <button
            type="button"
            onClick={saveAllPending}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-surface-base hover:bg-success-dark disabled:opacity-50 transition-colors shadow-lg"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Save {pending.length} measurement{pending.length > 1 ? "s" : ""}
          </button>
        )}

        {/* Saved indicator */}
        {savedCount > 0 && pending.length === 0 && (
          <div className="inline-flex items-center gap-1 rounded-md bg-surface-base/80 px-2 py-1 text-[10px] text-success backdrop-blur-sm">
            <CheckCircle2 size={10} />
            {savedCount} saved
          </div>
        )}

        {/* Bridge status */}
        {bridgeReady && !loading && (
          <div className="inline-flex items-center gap-1 rounded-md bg-surface-base/80 px-2 py-1 text-[10px] text-success/50 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Bridge
          </div>
        )}

        {/* 3D volume layout */}
        {!loading && !error && (
          <a
            href={ohif3dUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-surface-base/80 px-2 py-1 text-[10px] text-info hover:text-info transition-colors backdrop-blur-sm"
            title="Open OHIF in 3D volume layout"
          >
            3D
            <ExternalLink size={10} />
          </a>
        )}

        {/* MPR layout */}
        {!loading && !error && (
          <a
            href={ohifMprUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-surface-base/80 px-2 py-1 text-[10px] text-info hover:text-info transition-colors backdrop-blur-sm"
            title="Open OHIF in MPR layout"
          >
            MPR
            <ExternalLink size={10} />
          </a>
        )}

        {!loading && !error && (
          <a
            href={ohifUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-surface-base/80 px-2 py-1 text-[10px] text-text-ghost hover:text-text-muted transition-colors backdrop-blur-sm"
            title="Open OHIF in new tab"
          >
            <ExternalLink size={10} />
            Expand
          </a>
        )}
      </div>
    </div>
  );
}
