import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import { createPortal } from "react-dom";
import DimensionToggle from "@/features/administration/components/vector-explorer/DimensionToggle";
import {
  CLUSTER_PALETTE,
  POINT_RADIUS,
  POINT_SEGMENTS,
  HOVER_SCALE,
  SCENE_BG,
} from "@/features/administration/components/vector-explorer/constants";
import type { LandscapePoint, LandscapeCluster, LandscapeResult } from "../types/patientSimilarity";

// ── Constants ────────────────────────────────────────────────────────

const GENDER_LABELS: Record<number, string> = {
  8507: "Male",
  8532: "Female",
};

// Accent for controls chrome (matches Vector Explorer default "docs" theme).
const ACCENT_COLOR = "var(--success)";
const ACCENT_BG = "rgba(45, 212, 191, 0.10)";
const ACCENT_BORDER = "rgba(45, 212, 191, 0.25)";

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const ignoreRaycast: THREE.Object3D["raycast"] = () => {};

type ColorMode = "cohort" | "cluster";

// ── Props ────────────────────────────────────────────────────────────

interface PatientLandscapeProps {
  points: LandscapePoint[];
  clusters: LandscapeCluster[];
  stats: LandscapeResult["stats"];
  onPatientClick?: (personId: number) => void;
}

// ── Instanced Point Cloud (mirrors vector-explorer ThreeScene) ───────

interface PointCloudProps {
  points: LandscapePoint[];
  colorMode: ColorMode;
  hoveredIndex: number | null;
  selectedIndex: number | null;
  onHover: (index: number | null) => void;
  onClick: (index: number) => void;
}

function PointCloud({
  points,
  colorMode,
  hoveredIndex,
  selectedIndex,
  onHover,
  onClick,
}: PointCloudProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const previousHoveredRef = useRef<number | null>(null);

  // Create (and replace) the color attribute whenever point count changes.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const attr = new THREE.InstancedBufferAttribute(
      new Float32Array(points.length * 3),
      3,
    );
    mesh.geometry.setAttribute("color", attr);
    colorAttrRef.current = attr;
    return () => {
      mesh.geometry.deleteAttribute("color");
      colorAttrRef.current = null;
    };
  }, [points.length]);

  const getPointColor = useCallback(
    (point: LandscapePoint): string => {
      if (colorMode === "cluster") {
        return CLUSTER_PALETTE[point.cluster_id % CLUSTER_PALETTE.length];
      }
      // Cohort mode — use the same categorical palette so colors stay
      // consistent with the Vector Explorer. Cohort members = class 0,
      // non-members = class 1.
      return point.is_cohort_member
        ? CLUSTER_PALETTE[0]
        : CLUSTER_PALETTE[1];
    },
    [colorMode],
  );

  const setPointScaleAtIndex = useCallback(
    (index: number, scale: number) => {
      if (!meshRef.current || index < 0 || index >= points.length) return;
      const p = points[index];
      tempObject.position.set(p.x, p.y, p.z ?? 0);
      tempObject.scale.setScalar(scale);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(index, tempObject.matrix);
    },
    [points],
  );

  // Full rebuild of matrices + colors when points or color mode change.
  useEffect(() => {
    if (!meshRef.current || !colorAttrRef.current) return;
    const nextColors = new Float32Array(points.length * 3);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const scale = i === selectedIndex ? HOVER_SCALE : 1;
      setPointScaleAtIndex(i, scale);

      tempColor.set(getPointColor(p));
      nextColors[i * 3] = tempColor.r;
      nextColors[i * 3 + 1] = tempColor.g;
      nextColors[i * 3 + 2] = tempColor.b;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    colorAttrRef.current.copyArray(nextColors);
    colorAttrRef.current.needsUpdate = true;
  }, [points, selectedIndex, getPointColor, setPointScaleAtIndex]);

  // Targeted repaint on hover — only the prev + next hovered instances.
  useEffect(() => {
    if (!meshRef.current) {
      previousHoveredRef.current = hoveredIndex;
      return;
    }
    const touched = new Set<number>();
    if (previousHoveredRef.current !== null) touched.add(previousHoveredRef.current);
    if (hoveredIndex !== null) touched.add(hoveredIndex);
    if (touched.size === 0) return;

    for (const idx of touched) {
      const scale = idx === hoveredIndex || idx === selectedIndex ? HOVER_SCALE : 1;
      setPointScaleAtIndex(idx, scale);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    previousHoveredRef.current = hoveredIndex;
  }, [hoveredIndex, selectedIndex, setPointScaleAtIndex]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        if (e.instanceId !== hoveredIndex) onHover(e.instanceId);
      }
    },
    [hoveredIndex, points.length, onHover],
  );

  const handlePointerOut = useCallback(() => {
    if (hoveredIndex !== null) onHover(null);
  }, [hoveredIndex, onHover]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        onClick(e.instanceId);
      }
    },
    [points.length, onClick],
  );

  if (points.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, points.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      raycast={points.length > 0 ? undefined : ignoreRaycast}
    >
      <sphereGeometry args={[POINT_RADIUS, POINT_SEGMENTS, POINT_SEGMENTS]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

// ── Hover Tooltip (matches vector-explorer ThreeScene tooltip chrome) ─

interface TooltipProps {
  point: LandscapePoint;
  clusters: LandscapeCluster[];
}

function PointTooltip({ point, clusters }: TooltipProps) {
  const cluster = clusters.find((c) => c.id === point.cluster_id);
  return (
    <Html
      position={[point.x, point.y + 0.15, point.z ?? 0]}
      center
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="pointer-events-none whitespace-nowrap rounded bg-surface-raised/95 px-2 py-1 text-xs shadow-xl backdrop-blur"
        style={{ border: `1px solid ${ACCENT_BORDER}` }}
      >
        <div
          className="font-['IBM_Plex_Mono',monospace]"
          style={{ color: ACCENT_COLOR }}
        >
          Person {point.person_id}
        </div>
        <div className="text-text-muted">
          Age bucket:{" "}
          <span className="text-text-secondary">{point.age_bucket}</span>
        </div>
        <div className="text-text-muted">
          Gender:{" "}
          <span className="text-text-secondary">
            {GENDER_LABELS[point.gender_concept_id] ?? `ID ${point.gender_concept_id}`}
          </span>
        </div>
        {cluster && (
          <div className="text-text-muted">
            Cluster:{" "}
            <span className="text-text-secondary">
              {cluster.label ?? `#${cluster.id}`}
            </span>
          </div>
        )}
        {point.is_cohort_member && (
          <div className="mt-0.5" style={{ color: ACCENT_COLOR }}>
            Cohort member
          </div>
        )}
      </div>
    </Html>
  );
}

// ── Scene wrapper (mirrors vector-explorer ThreeScene) ───────────────

interface SceneProps {
  points: LandscapePoint[];
  clusters: LandscapeCluster[];
  colorMode: ColorMode;
  is2D: boolean;
  hoveredIndex: number | null;
  selectedIndex: number | null;
  onHover: (index: number | null) => void;
  onClick: (index: number) => void;
  autoRotateDisabled: boolean;
}

function Scene({
  points,
  clusters,
  colorMode,
  is2D,
  hoveredIndex,
  selectedIndex,
  onHover,
  onClick,
  autoRotateDisabled,
}: SceneProps) {
  const [isPointerInside, setIsPointerInside] = useState(false);
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div
      className="h-full w-full"
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerLeave={() => setIsPointerInside(false)}
    >
      <Canvas
        camera={{
          position: is2D ? [0, 0, 2.5] : [2, 2, 2],
          fov: 50,
        }}
        style={{ background: SCENE_BG }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.8} />
        <PointCloud
          points={points}
          colorMode={colorMode}
          hoveredIndex={hoveredIndex}
          selectedIndex={selectedIndex}
          onHover={onHover}
          onClick={onClick}
        />
        <OrbitControls
          autoRotate={!is2D && !autoRotateDisabled && !isPointerInside}
          autoRotateSpeed={0.5}
          enableRotate={!is2D}
          enablePan
          enableZoom
          dampingFactor={0.1}
          enableDamping
          makeDefault
        />
        {hoveredPoint && <PointTooltip point={hoveredPoint} clusters={clusters} />}
      </Canvas>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function PatientLandscape({
  points,
  clusters,
  stats,
  onPatientClick,
}: PatientLandscapeProps) {
  const [dimensions, setDimensions] = useState<2 | 3>(3);
  const [colorMode, setColorMode] = useState<ColorMode>("cohort");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const is2D = dimensions === 2;
  const cohortCount = useMemo(
    () => points.filter((p) => p.is_cohort_member).length,
    [points],
  );

  const handleClick = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      const p = points[index];
      if (p && onPatientClick) onPatientClick(p.person_id);
    },
    [points, onPatientClick],
  );

  const sceneContent = (
    <Scene
      points={points}
      clusters={clusters}
      colorMode={colorMode}
      is2D={is2D}
      hoveredIndex={hoveredIndex}
      selectedIndex={selectedIndex}
      onHover={setHoveredIndex}
      onClick={handleClick}
      autoRotateDisabled={isExpanded}
    />
  );

  const header = (
    <div className="flex items-center justify-between border-b border-border-default bg-surface-base px-4 py-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {dimensions}D Patient Landscape
        </h3>
        <div className="flex items-center gap-1 rounded border border-border-default bg-surface-base p-0.5">
          <span className="px-1 text-xs text-text-ghost">Color</span>
          {(["cohort", "cluster"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setColorMode(mode)}
              className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
              style={
                colorMode === mode
                  ? { background: ACCENT_BG, color: ACCENT_COLOR }
                  : { color: "var(--text-ghost)" }
              }
            >
              {mode === "cohort" ? "Cohort" : "Cluster"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <DimensionToggle
          value={dimensions}
          onChange={setDimensions}
          accentColor={ACCENT_COLOR}
          accentBg={ACCENT_BG}
        />
        <button
          type="button"
          onClick={() => {
            setHoveredIndex(null);
            setSelectedIndex(null);
          }}
          title="Reset selection"
          className="rounded p-1 text-text-muted hover:bg-surface-raised hover:text-text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          title={isExpanded ? "Collapse" : "Expand"}
          className="rounded p-1 text-text-muted hover:bg-surface-raised hover:text-text-primary"
        >
          {isExpanded ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );

  const statsBar = (
    <div className="flex items-center justify-between border-t border-border-default bg-surface-base px-4 py-1.5 text-xs text-text-ghost">
      <div className="flex items-center gap-4">
        <span>
          <span className="text-text-secondary font-medium">
            {points.length.toLocaleString()}
          </span>{" "}
          patients
        </span>
        {clusters.length > 0 && (
          <span>
            <span className="text-text-secondary">{clusters.length}</span> clusters
          </span>
        )}
        {stats?.projection_time_ms != null && stats.projection_time_ms > 0 && (
          <span>
            Projection{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
              {(stats.projection_time_ms / 1000).toFixed(1)}s
            </span>
          </span>
        )}
      </div>
    </div>
  );

  // Legend — cluster mode or cohort mode.
  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-default bg-surface-base px-4 py-2 text-xs">
      {colorMode === "cohort" ? (
        <>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: CLUSTER_PALETTE[0] }}
            />
            Cohort members{" "}
            <span className="text-text-ghost">({cohortCount.toLocaleString()})</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: CLUSTER_PALETTE[1] }}
            />
            Non-members{" "}
            <span className="text-text-ghost">
              ({(points.length - cohortCount).toLocaleString()})
            </span>
          </div>
        </>
      ) : (
        clusters.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-1.5 text-text-secondary"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: CLUSTER_PALETTE[c.id % CLUSTER_PALETTE.length],
              }}
            />
            {c.label ?? `Cluster ${c.id}`}{" "}
            <span className="text-text-ghost">({c.size.toLocaleString()})</span>
          </div>
        ))
      )}
    </div>
  );

  if (isExpanded) {
    return createPortal(
      <div
        className="fixed inset-0 flex flex-col bg-surface-darkest"
        style={{ zIndex: 200 }}
      >
        {header}
        <div className="flex-1">{sceneContent}</div>
        {legend}
        {statsBar}
      </div>,
      document.body,
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-surface-base">
      {header}
      <div className="relative" style={{ height: 560 }}>
        {sceneContent}
      </div>
      {legend}
      {statsBar}
    </div>
  );
}
