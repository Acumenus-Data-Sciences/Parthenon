/**
 * DicomViewer — Cornerstone3D-powered DICOM stack viewer.
 *
 * Loads DICOM instances via the Parthenon WADO-URI endpoint and renders
 * a scrollable axial stack with window/level, zoom, and pan tools.
 */

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { Loader2, RefreshCw, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import * as cornerstone from "@cornerstonejs/core";
import {
  init as csToolsInit,
  addTool,
  ToolGroupManager,
  WindowLevelTool,
  StackScrollTool,
  ZoomTool,
  PanTool,
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

// ──────────────────────────────────────────────────────────────────────────────
// One-time Cornerstone initialisation
// ──────────────────────────────────────────────────────────────────────────────

let cornerstoneInitialised = false;

async function initCornerstone() {
  if (cornerstoneInitialised) return;
  cornerstoneInitialised = true;

  await cornerstone.init();

  // @cornerstonejs/dicom-image-loader v3+ uses init() which auto-registers
  // the 'wadouri:' and 'wadors:' image loader schemes with cornerstone core.
  dicomImageLoaderInit();

  // Init tools
  csToolsInit();
  addTool(StackScrollTool);
  addTool(ZoomTool);
  addTool(PanTool);
  addTool(WindowLevelTool);
}

// ──────────────────────────────────────────────────────────────────────────────
// WADO-URI builder
// ──────────────────────────────────────────────────────────────────────────────

function buildWadoId(sopUid: string): string {
  const base = window.location.origin;
  return `wadouri:${base}/api/v1/imaging/wado/${encodeURIComponent(sopUid)}`;
}

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
  const [activeTool, setActiveTool] = useState("WindowLevel");

  // ── Dynamic viewport height: stretch to 30px above browser bottom ────────
  useLayoutEffect(() => {
    function recalc() {
      if (!containerEl.current) return;
      const rect = containerEl.current.getBoundingClientRect();
      // 30px bottom margin + ~24px for the hints text below the viewport
      const available = window.innerHeight - rect.top - 30 - 24;
      setVpHeight(Math.max(300, available));
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [instances.length]);

  const engineId = `engine-${studyId}`;
  const viewportId = `vp-${studyId}`;
  const toolGroupId = `tg-${studyId}`;

  // ── Fetch instance list ──────────────────────────────────────────────────
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
            (b.instance_number ?? b.slice_location ?? 0)
        );
        setInstances(data);
      })
      .catch(() => setError("Failed to load DICOM instance list"))
      .finally(() => setLoading(false));
  }, [studyId]);

  // ── Initialise Cornerstone + viewport ───────────────────────────────────
  useEffect(() => {
    if (instances.length === 0 || !viewportEl.current) return;

    let cancelled = false;
    setLoadingViewer(true);

    (async () => {
      try {
        await initCornerstone();
        if (cancelled || !viewportEl.current) return;

        // Destroy previous engine
        cornerstone.getRenderingEngine(engineId)?.destroy();
        // Destroy previous tool group (check existence first — destroyToolGroup throws if missing)
        if (ToolGroupManager.getToolGroup(toolGroupId)) {
          ToolGroupManager.destroyToolGroup(toolGroupId);
        }

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

        // Tool group
        const tg = ToolGroupManager.createToolGroup(toolGroupId)!;
        tg.addTool(WindowLevelTool.toolName);
        tg.addTool(StackScrollTool.toolName);
        tg.addTool(ZoomTool.toolName);
        tg.addTool(PanTool.toolName);
        tg.addViewport(viewportId, engineId);

        applyToolBindings(tg, WindowLevelTool.toolName);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoadingViewer(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cornerstone.getRenderingEngine(engineId)?.destroy();
      if (ToolGroupManager.getToolGroup(toolGroupId)) {
        ToolGroupManager.destroyToolGroup(toolGroupId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helper: activate a primary-button tool ───────────────────────────────
  const applyToolBindings = (
    tg: ReturnType<typeof ToolGroupManager.createToolGroup>,
    toolName: string
  ) => {
    [WindowLevelTool.toolName, ZoomTool.toolName, PanTool.toolName].forEach((t) => {
      try { tg!.setToolEnabled(t); } catch (_) {}
    });
    tg!.setToolActive(toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
    });
    tg!.setToolActive(PanTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
    });
    tg!.setToolActive(ZoomTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
    });
    tg!.setToolActive(StackScrollTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
    });
  };

  // ── Navigate slice ───────────────────────────────────────────────────────
  const goToSlice = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(instances.length - 1, idx));
      setCurrentIndex(clamped);
      try {
        const vp = cornerstone
          .getRenderingEngine(engineId)
          ?.getViewport(viewportId) as cornerstone.Types.IStackViewport | undefined;
        vp?.setImageIdIndex(clamped);
        vp?.render();
      } catch (_) {}
    },
    [instances.length, engineId, viewportId]
  );

  // ── Tool toggle ──────────────────────────────────────────────────────────
  const setTool = useCallback(
    (toolName: string) => {
      setActiveTool(toolName);
      const tg = ToolGroupManager.getToolGroup(toolGroupId);
      if (tg) applyToolBindings(tg, toolName);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolGroupId]
  );

  const reset = useCallback(() => {
    try {
      const vp = cornerstone
        .getRenderingEngine(engineId)
        ?.getViewport(viewportId) as cornerstone.Types.IStackViewport | undefined;
      vp?.resetCamera();
      (vp as unknown as { resetProperties?: () => void })?.resetProperties?.();
      vp?.render();
    } catch (_) {}
  }, [engineId, viewportId]);

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
            Use the <span className="text-[#2DD4BF]">Import Local DICOM Files</span> panel on the Studies page to load DICOM files from the server.
          </p>
        </div>
      </div>
    );
  }

  const TOOLS = [
    { id: WindowLevelTool.toolName, label: "W/L" },
    { id: ZoomTool.toolName, label: "Zoom" },
    { id: PanTool.toolName, label: "Pan" },
  ];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-[#232328] bg-[#0E0E11] p-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTool === t.id
                  ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                  : "text-[#5A5650] hover:text-[#8A857D]"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            title="Reset view"
            className="ml-1 p-1.5 text-[#5A5650] hover:text-[#8A857D] transition-colors"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Slice navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToSlice(currentIndex - 1)}
            disabled={currentIndex === 0}
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
            disabled={currentIndex >= instances.length - 1}
            className="p-1 rounded text-[#5A5650] hover:text-[#8A857D] disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Viewport canvas */}
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

      {/* Hints */}
      <p className="text-[10px] text-[#5A5650] text-center">
        Left-drag: {activeTool} · Scroll wheel: slice · Middle-drag: pan · Right-drag: zoom
      </p>
    </div>
  );
}
