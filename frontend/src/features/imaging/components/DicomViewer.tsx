/**
 * DicomViewer — Cornerstone3D v4 powered DICOM stack viewer.
 *
 * Loads DICOM instances via the Parthenon WADO-URI endpoint and renders
 * a scrollable stack with comprehensive radiology tooling.
 */

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import {
  Loader2, RefreshCw, Layers, ChevronLeft, ChevronRight,
  Play, Pause, Ruler, FlipHorizontal, FlipVertical,
  Circle, Contrast, Maximize2, MousePointer,
} from "lucide-react";
import * as cornerstone from "@cornerstonejs/core";
import {
  init as csToolsInit,
  addTool,
  ToolGroupManager,
  WindowLevelTool,
  StackScrollTool,
  ZoomTool,
  PanTool,
  LengthTool,
  AngleTool,
  EllipticalROITool,
  RectangleROITool,
  ArrowAnnotateTool,
  ProbeTool,
  BidirectionalTool,
  PlanarRotateTool,
  MagnifyTool,
  PlanarFreehandROITool,
  Enums as csToolsEnums,
} from "@cornerstonejs/tools";
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader";
import apiClient from "@/lib/api-client";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface DicomInstance {
  id: number;
  series_id: number;
  sop_instance_uid: string;
  instance_number: number | null;
  slice_location: number | null;
  file_path: string | null;
}

interface DicomViewerProps {
  studyId: number;
  className?: string;
}

interface WindowPreset {
  label: string;
  ww: number;
  wc: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const WINDOW_PRESETS: WindowPreset[] = [
  { label: "Brain",       ww: 80,   wc: 40 },
  { label: "Lung",        ww: 1500, wc: -600 },
  { label: "Bone",        ww: 2500, wc: 480 },
  { label: "Abdomen",     ww: 400,  wc: 50 },
  { label: "Soft Tissue", ww: 350,  wc: 50 },
  { label: "Chest",       ww: 400,  wc: 40 },
  { label: "Liver",       ww: 150,  wc: 30 },
  { label: "Mediastinum", ww: 350,  wc: 50 },
];

const ALL_TOOL_CLASSES = [
  WindowLevelTool, StackScrollTool, ZoomTool, PanTool,
  LengthTool, AngleTool, EllipticalROITool, RectangleROITool,
  ArrowAnnotateTool, ProbeTool, BidirectionalTool,
  PlanarRotateTool, MagnifyTool, PlanarFreehandROITool,
];

// ──────────────────────────────────────────────────────────────────────────────
// One-time Cornerstone initialisation (singleton promise)
// ──────────────────────────────────────────────────────────────────────────────

let csInitPromise: Promise<void> | null = null;

function initCornerstone(): Promise<void> {
  if (csInitPromise) return csInitPromise;

  csInitPromise = (async () => {
    await cornerstone.init();
    dicomImageLoaderInit();
    csToolsInit();

    // Register all tools globally (idempotent — wrapped in try/catch per tool)
    for (const ToolClass of ALL_TOOL_CLASSES) {
      try {
        addTool(ToolClass);
      } catch {
        // Already registered — safe to ignore
      }
    }
  })();

  return csInitPromise;
}

// ──────────────────────────────────────────────────────────────────────────────
// WADO-URI builder
// ──────────────────────────────────────────────────────────────────────────────

function buildWadoId(sopUid: string): string {
  const base = window.location.origin;
  return `wadouri:${base}/api/v1/imaging/wado/${encodeURIComponent(sopUid)}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool definitions for the toolbar
// ──────────────────────────────────────────────────────────────────────────────

interface ToolDef {
  name: string;
  label: string;
  group: "interact" | "measure" | "roi";
  icon?: React.ReactNode;
}

const TOOLBAR_TOOLS: ToolDef[] = [
  // Interaction tools
  { name: WindowLevelTool.toolName, label: "W/L",     group: "interact" },
  { name: ZoomTool.toolName,        label: "Zoom",    group: "interact" },
  { name: PanTool.toolName,         label: "Pan",     group: "interact" },
  { name: MagnifyTool.toolName,     label: "Magnify", group: "interact" },
  { name: PlanarRotateTool.toolName,label: "Rotate",  group: "interact" },
  // Measurement tools
  { name: LengthTool.toolName,        label: "Length",  group: "measure" },
  { name: AngleTool.toolName,         label: "Angle",   group: "measure" },
  { name: BidirectionalTool.toolName, label: "Bidir",   group: "measure" },
  { name: ProbeTool.toolName,         label: "Probe",   group: "measure" },
  { name: ArrowAnnotateTool.toolName, label: "Arrow",   group: "measure" },
  // ROI tools
  { name: EllipticalROITool.toolName,     label: "Ellipse",  group: "roi" },
  { name: RectangleROITool.toolName,      label: "Rect",     group: "roi" },
  { name: PlanarFreehandROITool.toolName, label: "Freehand", group: "roi" },
];

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function DicomViewer({ studyId, className = "" }: DicomViewerProps) {
  const viewportEl = useRef<HTMLDivElement>(null);
  const containerEl = useRef<HTMLDivElement>(null);
  const [vpHeight, setVpHeight] = useState(480);

  const [instances, setInstances] = useState<DicomInstance[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingViewer, setLoadingViewer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState(WindowLevelTool.toolName);
  const [isInverted, setIsInverted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cineFps, setCineFps] = useState(10);
  const [showPresets, setShowPresets] = useState(false);
  const cineRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const engineId = `engine-${studyId}`;
  const viewportId = `vp-${studyId}`;
  const toolGroupId = `tg-${studyId}`;

  // ── Dynamic viewport height ─────────────────────────────────────────────
  useLayoutEffect(() => {
    function recalc() {
      if (!containerEl.current) return;
      const rect = containerEl.current.getBoundingClientRect();
      const available = window.innerHeight - rect.top - 30 - 24;
      setVpHeight(Math.max(300, available));
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [instances.length]);

  // ── Fetch instance list ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/imaging/studies/${studyId}/instances`)
      .then((res) => {
        const data: DicomInstance[] = res.data.data ?? [];
        data.sort(
          (a, b) =>
            (a.instance_number ?? a.slice_location ?? 0) -
            (b.instance_number ?? b.slice_location ?? 0),
        );
        setInstances(data);
      })
      .catch(() => setError("Failed to load DICOM instance list"))
      .finally(() => setLoading(false));
  }, [studyId]);

  // ── Helper: apply tool bindings ─────────────────────────────────────────
  const applyToolBindings = useCallback(
    (tg: ReturnType<typeof ToolGroupManager.getToolGroup>, toolName: string) => {
      if (!tg) return;

      // Deactivate all interactive tools first, then set the primary one
      const allInteractive = TOOLBAR_TOOLS.map((t) => t.name);
      for (const t of allInteractive) {
        try { tg.setToolEnabled(t); } catch { /* not added */ }
      }

      // Primary tool on left click
      tg.setToolActive(toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });

      // Always bind pan to middle, zoom to right, scroll to wheel
      tg.setToolActive(PanTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
      });
      tg.setToolActive(ZoomTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
      });
      tg.setToolActive(StackScrollTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
      });
    },
    [],
  );

  // ── Initialise Cornerstone + viewport ───────────────────────────────────
  useEffect(() => {
    if (instances.length === 0 || !viewportEl.current) return;

    let cancelled = false;
    setLoadingViewer(true);

    (async () => {
      try {
        await initCornerstone();
        if (cancelled || !viewportEl.current) return;

        // ── Destroy previous resources synchronously ──────────────────
        try { cornerstone.getRenderingEngine(engineId)?.destroy(); } catch { /* ok */ }
        try {
          if (ToolGroupManager.getToolGroup(toolGroupId)) {
            ToolGroupManager.destroyToolGroup(toolGroupId);
          }
        } catch { /* ok */ }

        // ── Create rendering engine + viewport ────────────────────────
        const engine = new cornerstone.RenderingEngine(engineId);
        engine.enableElement({
          viewportId,
          type: cornerstone.Enums.ViewportType.STACK,
          element: viewportEl.current,
        });

        const viewport = engine.getViewport(viewportId) as cornerstone.Types.IStackViewport;
        const imageIds = instances.map((i) => buildWadoId(i.sop_instance_uid));
        await viewport.setStack(imageIds, 0);
        viewport.render();

        // ── Create tool group ─────────────────────────────────────────
        const tg = ToolGroupManager.createToolGroup(toolGroupId);
        if (!tg) {
          throw new Error("Failed to create tool group — ID may already exist");
        }

        for (const ToolClass of ALL_TOOL_CLASSES) {
          try { tg.addTool(ToolClass.toolName); } catch { /* already added */ }
        }
        tg.addViewport(viewportId, engineId);

        applyToolBindings(tg, WindowLevelTool.toolName);
        setActiveTool(WindowLevelTool.toolName);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoadingViewer(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Stop CINE
      if (cineRef.current) clearInterval(cineRef.current);
      // Destroy cornerstone resources
      try { cornerstone.getRenderingEngine(engineId)?.destroy(); } catch { /* ok */ }
      try {
        if (ToolGroupManager.getToolGroup(toolGroupId)) {
          ToolGroupManager.destroyToolGroup(toolGroupId);
        }
      } catch { /* ok */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Get viewport helper ─────────────────────────────────────────────────
  const getViewport = useCallback(() => {
    try {
      return cornerstone
        .getRenderingEngine(engineId)
        ?.getViewport(viewportId) as cornerstone.Types.IStackViewport | undefined;
    } catch {
      return undefined;
    }
  }, [engineId, viewportId]);

  // ── Navigate slice ──────────────────────────────────────────────────────
  const goToSlice = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(instances.length - 1, idx));
      setCurrentIndex(clamped);
      const vp = getViewport();
      if (vp) {
        vp.setImageIdIndex(clamped);
        vp.render();
      }
    },
    [instances.length, getViewport],
  );

  // ── Tool toggle ─────────────────────────────────────────────────────────
  const setTool = useCallback(
    (toolName: string) => {
      setActiveTool(toolName);
      const tg = ToolGroupManager.getToolGroup(toolGroupId);
      applyToolBindings(tg, toolName);
    },
    [toolGroupId, applyToolBindings],
  );

  // ── Reset view ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    const vp = getViewport();
    if (!vp) return;
    vp.resetCamera();
    (vp as unknown as { resetProperties?: () => void })?.resetProperties?.();
    setIsInverted(false);
    vp.render();
  }, [getViewport]);

  // ── Invert ──────────────────────────────────────────────────────────────
  const toggleInvert = useCallback(() => {
    const vp = getViewport();
    if (!vp) return;
    const newInvert = !isInverted;
    setIsInverted(newInvert);
    vp.setProperties({ invert: newInvert });
    vp.render();
  }, [getViewport, isInverted]);

  // ── Flip ────────────────────────────────────────────────────────────────
  const flipH = useCallback(() => {
    const vp = getViewport();
    if (!vp) return;
    const camera = vp.getCamera();
    const vn = camera.viewPlaneNormal;
    if (vn) {
      vp.setCamera({
        viewPlaneNormal: [vn[0], vn[1], vn[2]],
        viewUp: camera.viewUp ? [-camera.viewUp[0], camera.viewUp[1], camera.viewUp[2]] as cornerstone.Types.Point3 : undefined,
      });
    }
    const { flipHorizontal } = vp.getCamera();
    vp.setCamera({ flipHorizontal: !flipHorizontal });
    vp.render();
  }, [getViewport]);

  const flipV = useCallback(() => {
    const vp = getViewport();
    if (!vp) return;
    const { flipVertical } = vp.getCamera();
    vp.setCamera({ flipVertical: !flipVertical });
    vp.render();
  }, [getViewport]);

  // ── Window preset ───────────────────────────────────────────────────────
  const applyWindowPreset = useCallback(
    (preset: WindowPreset) => {
      const vp = getViewport();
      if (!vp) return;
      vp.setProperties({
        voiRange: {
          lower: preset.wc - preset.ww / 2,
          upper: preset.wc + preset.ww / 2,
        },
      });
      vp.render();
      setShowPresets(false);
    },
    [getViewport],
  );

  // ── CINE playback ──────────────────────────────────────────────────────
  const toggleCine = useCallback(() => {
    if (isPlaying) {
      if (cineRef.current) clearInterval(cineRef.current);
      cineRef.current = null;
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      let idx = currentIndex;
      cineRef.current = setInterval(() => {
        idx = (idx + 1) % instances.length;
        setCurrentIndex(idx);
        const vp = getViewport();
        if (vp) {
          vp.setImageIdIndex(idx);
          vp.render();
        }
      }, 1000 / cineFps);
    }
  }, [isPlaying, currentIndex, instances.length, cineFps, getViewport]);

  // Stop CINE when fps changes
  useEffect(() => {
    if (isPlaying) {
      if (cineRef.current) clearInterval(cineRef.current);
      let idx = currentIndex;
      cineRef.current = setInterval(() => {
        idx = (idx + 1) % instances.length;
        setCurrentIndex(idx);
        const vp = getViewport();
        if (vp) {
          vp.setImageIdIndex(idx);
          vp.render();
        }
      }, 1000 / cineFps);
    }
    return () => {
      if (cineRef.current) clearInterval(cineRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cineFps]);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-[#232328] bg-[#0E0E11] ${className}`}
        style={{ minHeight: 460 }}
      >
        <div className="flex flex-col items-center gap-3 text-[#8A857D]">
          <Loader2 size={28} className="animate-spin text-[#2DD4BF]" />
          <p className="text-sm">Loading instance registry…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5 ${className}`}
        style={{ minHeight: 460 }}
      >
        <p className="text-sm text-[#E85A6B]">{error}</p>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-[#232328] bg-[#0E0E11] ${className}`}
        style={{ minHeight: 460 }}
      >
        <div className="flex flex-col items-center gap-3 text-[#5A5650]">
          <Layers size={32} />
          <p className="text-sm font-medium">No instances indexed for this study</p>
          <p className="text-xs text-center max-w-xs">
            Use the <span className="text-[#2DD4BF]">Import Local DICOM Files</span> panel on the
            Studies page to load DICOM files from the server.
          </p>
        </div>
      </div>
    );
  }

  const toolGroups = {
    interact: TOOLBAR_TOOLS.filter((t) => t.group === "interact"),
    measure: TOOLBAR_TOOLS.filter((t) => t.group === "measure"),
    roi: TOOLBAR_TOOLS.filter((t) => t.group === "roi"),
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* ── Primary toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Interaction tools */}
          <ToolGroup tools={toolGroups.interact} active={activeTool} onSelect={setTool} />

          {/* Separator */}
          <div className="w-px h-5 bg-[#232328]" />

          {/* Measurement tools */}
          <ToolGroup
            tools={toolGroups.measure}
            active={activeTool}
            onSelect={setTool}
            icon={<Ruler size={10} className="text-[#5A5650]" />}
          />

          {/* Separator */}
          <div className="w-px h-5 bg-[#232328]" />

          {/* ROI tools */}
          <ToolGroup
            tools={toolGroups.roi}
            active={activeTool}
            onSelect={setTool}
            icon={<Circle size={10} className="text-[#5A5650]" />}
          />
        </div>

        {/* Right side: image manipulation + slice nav */}
        <div className="flex items-center gap-2">
          {/* Image manipulation buttons */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[#232328] bg-[#0E0E11] p-0.5">
            <IconButton onClick={toggleInvert} title="Invert" active={isInverted}>
              <Contrast size={13} />
            </IconButton>
            <IconButton onClick={flipH} title="Flip Horizontal">
              <FlipHorizontal size={13} />
            </IconButton>
            <IconButton onClick={flipV} title="Flip Vertical">
              <FlipVertical size={13} />
            </IconButton>
            <IconButton onClick={reset} title="Reset View">
              <RefreshCw size={12} />
            </IconButton>
          </div>

          {/* Window presets */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-1 rounded-lg border border-[#232328] bg-[#0E0E11] px-2.5 py-1.5 text-[10px] font-medium text-[#5A5650] hover:text-[#8A857D] transition-colors"
            >
              <Maximize2 size={11} />
              Presets
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-[#232328] bg-[#151518] shadow-xl py-1 min-w-[140px]">
                {WINDOW_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyWindowPreset(p)}
                    className="block w-full px-3 py-1.5 text-left text-xs text-[#8A857D] hover:bg-[#1A1A1F] hover:text-[#F0EDE8] transition-colors"
                  >
                    <span className="font-medium">{p.label}</span>
                    <span className="ml-2 text-[#5A5650]">
                      W:{p.ww} L:{p.wc}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-[#232328]" />

          {/* CINE playback */}
          <div className="flex items-center gap-1 rounded-lg border border-[#232328] bg-[#0E0E11] p-0.5">
            <button
              type="button"
              onClick={toggleCine}
              title={isPlaying ? "Stop CINE" : "Play CINE"}
              className={`p-1.5 rounded-md transition-colors ${
                isPlaying
                  ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                  : "text-[#5A5650] hover:text-[#8A857D]"
              }`}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <select
              value={cineFps}
              onChange={(e) => setCineFps(Number(e.target.value))}
              className="bg-transparent text-[10px] text-[#5A5650] border-none outline-none cursor-pointer pr-1"
              title="CINE FPS"
            >
              {[5, 10, 15, 20, 30].map((fps) => (
                <option key={fps} value={fps}>
                  {fps}fps
                </option>
              ))}
            </select>
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-[#232328]" />

          {/* Slice navigation */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToSlice(currentIndex - 1)}
              disabled={currentIndex === 0 || isPlaying}
              className="p-1 rounded text-[#5A5650] hover:text-[#8A857D] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[#8A857D] font-['IBM_Plex_Mono',monospace] min-w-[4rem] text-center">
              {currentIndex + 1} / {instances.length}
            </span>
            <button
              type="button"
              onClick={() => goToSlice(currentIndex + 1)}
              disabled={currentIndex >= instances.length - 1 || isPlaying}
              className="p-1 rounded text-[#5A5650] hover:text-[#8A857D] disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Viewport canvas ─────────────────────────────────────────────── */}
      <div ref={containerEl} className="relative">
        {loadingViewer && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0E0E11]/80 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-[#8A857D]">
              <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
              <p className="text-xs">Loading first image…</p>
            </div>
          </div>
        )}
        <div
          ref={viewportEl}
          className="w-full rounded-lg overflow-hidden bg-black border border-[#1E1E23]"
          style={{ height: vpHeight, cursor: "crosshair" }}
        />
      </div>

      {/* ── Hints ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#5A5650]">
          <MousePointer size={10} className="inline mr-1" />
          Left-drag: {activeTool} · Scroll: slice · Middle: pan · Right: zoom
        </p>
        <p className="text-[10px] text-[#5A5650]">
          {instances.length} image{instances.length !== 1 ? "s" : ""}
          {isPlaying && <span className="ml-2 text-[#2DD4BF]">CINE {cineFps}fps</span>}
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────────

function ToolGroup({
  tools,
  active,
  onSelect,
  icon,
}: {
  tools: ToolDef[];
  active: string;
  onSelect: (name: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[#232328] bg-[#0E0E11] p-0.5">
      {icon && <span className="px-1">{icon}</span>}
      {tools.map((t) => (
        <button
          key={t.name}
          type="button"
          onClick={() => onSelect(t.name)}
          className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
            active === t.name
              ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
              : "text-[#5A5650] hover:text-[#8A857D]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function IconButton({
  onClick,
  title,
  children,
  active = false,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
          : "text-[#5A5650] hover:text-[#8A857D]"
      }`}
    >
      {children}
    </button>
  );
}
