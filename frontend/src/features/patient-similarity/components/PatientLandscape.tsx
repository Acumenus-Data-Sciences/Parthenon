import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { RefreshCw, Maximize2, Minimize2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import DimensionToggle from "@/features/administration/components/vector-explorer/DimensionToggle";
import {
  CLUSTER_PALETTE,
  POINT_RADIUS,
  POINT_SEGMENTS,
  HOVER_SCALE,
  SCENE_BG,
} from "@/features/administration/components/vector-explorer/constants";
import type {
  LandscapePoint,
  LandscapeCluster,
  LandscapeResult,
} from "../types/patientSimilarity";

// ── Constants ────────────────────────────────────────────────────────

const GENDER_LABELS: Record<number, string> = {
  8507: "Male",
  8532: "Female",
};

// Accent for controls chrome (matches Vector Explorer default theme).
const ACCENT_COLOR = "var(--success)";
const ACCENT_BG = "rgba(45, 212, 191, 0.10)";
const ACCENT_BORDER = "rgba(45, 212, 191, 0.25)";

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const ignoreRaycast: THREE.Object3D["raycast"] = () => {};

type ColorMode = "cohort" | "cluster";

function ageBucketLabel(bucket: number | null | undefined): string {
  if (bucket == null) return "—";
  const lo = bucket * 5;
  return `${lo}–${lo + 4}`;
}

function genderLabel(id: number): string {
  return GENDER_LABELS[id] ?? `Concept ${id}`;
}

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
  selectedIndices: Set<number>;
  hiddenClusterIds: Set<number>;
  onHover: (index: number | null) => void;
  onClick: (index: number, multi: boolean) => void;
}

function PointCloud({
  points,
  colorMode,
  hoveredIndex,
  selectedIndices,
  hiddenClusterIds,
  onHover,
  onClick,
}: PointCloudProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const previousHoveredRef = useRef<number | null>(null);

  // (Re)allocate the per-instance color attribute whenever point count changes.
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
      return point.is_cohort_member ? CLUSTER_PALETTE[0] : CLUSTER_PALETTE[1];
    },
    [colorMode],
  );

  const setPointMatrixAtIndex = useCallback(
    (index: number, scale: number, hidden: boolean) => {
      if (!meshRef.current || index < 0 || index >= points.length) return;
      const p = points[index];
      tempObject.position.set(p.x, p.y, p.z ?? 0);
      tempObject.scale.setScalar(hidden ? 0 : scale);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(index, tempObject.matrix);
    },
    [points],
  );

  // Full rebuild — matrices + colors — on points / colorMode / selection /
  // visibility changes.
  useEffect(() => {
    if (!meshRef.current || !colorAttrRef.current) return;
    const nextColors = new Float32Array(points.length * 3);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const hidden = hiddenClusterIds.has(p.cluster_id);
      const scale =
        i === hoveredIndex || selectedIndices.has(i) ? HOVER_SCALE : 1;
      setPointMatrixAtIndex(i, scale, hidden);

      tempColor.set(getPointColor(p));
      nextColors[i * 3] = tempColor.r;
      nextColors[i * 3 + 1] = tempColor.g;
      nextColors[i * 3 + 2] = tempColor.b;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    colorAttrRef.current.copyArray(nextColors);
    colorAttrRef.current.needsUpdate = true;
  }, [
    points,
    hoveredIndex,
    selectedIndices,
    hiddenClusterIds,
    getPointColor,
    setPointMatrixAtIndex,
  ]);

  // Targeted repaint on hover — only the prev + next hovered instances.
  useEffect(() => {
    if (!meshRef.current) {
      previousHoveredRef.current = hoveredIndex;
      return;
    }
    const touched = new Set<number>();
    if (previousHoveredRef.current !== null)
      touched.add(previousHoveredRef.current);
    if (hoveredIndex !== null) touched.add(hoveredIndex);
    if (touched.size === 0) return;

    for (const idx of touched) {
      const p = points[idx];
      if (!p) continue;
      const hidden = hiddenClusterIds.has(p.cluster_id);
      const scale =
        idx === hoveredIndex || selectedIndices.has(idx) ? HOVER_SCALE : 1;
      setPointMatrixAtIndex(idx, scale, hidden);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    previousHoveredRef.current = hoveredIndex;
  }, [
    hoveredIndex,
    selectedIndices,
    hiddenClusterIds,
    points,
    setPointMatrixAtIndex,
  ]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        const p = points[e.instanceId];
        if (hiddenClusterIds.has(p.cluster_id)) return;
        if (e.instanceId !== hoveredIndex) onHover(e.instanceId);
      }
    },
    [hoveredIndex, points, hiddenClusterIds, onHover],
  );

  const handlePointerOut = useCallback(() => {
    if (hoveredIndex !== null) onHover(null);
  }, [hoveredIndex, onHover]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        const p = points[e.instanceId];
        if (hiddenClusterIds.has(p.cluster_id)) return;
        onClick(e.instanceId, e.shiftKey);
      }
    },
    [points, hiddenClusterIds, onClick],
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

// ── Hover Tooltip (inside canvas via drei <Html>) ────────────────────

interface TooltipProps {
  point: LandscapePoint;
  clusters: LandscapeCluster[];
}

function PointTooltip({ point, clusters }: TooltipProps) {
  const { t } = useTranslation("app");
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
          {t("patientSimilarity.common.personLabel", { id: point.person_id })}
        </div>
        <div className="text-text-muted">
          {t("patientSimilarity.landscape.ageBucket")}:{" "}
          <span className="text-text-secondary">{ageBucketLabel(point.age_bucket)}</span>
        </div>
        <div className="text-text-muted">
          {t("patientSimilarity.landscape.pointGender")}:{" "}
          <span className="text-text-secondary">
            {genderLabel(point.gender_concept_id)}
          </span>
        </div>
        {cluster && (
          <div className="text-text-muted">
            {t("patientSimilarity.landscape.pointCluster")}:{" "}
            <span className="text-text-secondary">
              {cluster.label ?? `#${cluster.id}`}
            </span>
          </div>
        )}
        {point.is_cohort_member && (
          <div className="mt-0.5" style={{ color: ACCENT_COLOR }}>
            {t("patientSimilarity.landscape.cohortMember")}
          </div>
        )}
      </div>
    </Html>
  );
}

// ── Scene wrapper ────────────────────────────────────────────────────

interface SceneProps {
  points: LandscapePoint[];
  clusters: LandscapeCluster[];
  colorMode: ColorMode;
  is2D: boolean;
  hoveredIndex: number | null;
  selectedIndices: Set<number>;
  hiddenClusterIds: Set<number>;
  onHover: (index: number | null) => void;
  onClick: (index: number, multi: boolean) => void;
  autoRotateDisabled: boolean;
}

function Scene({
  points,
  clusters,
  colorMode,
  is2D,
  hoveredIndex,
  selectedIndices,
  hiddenClusterIds,
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
          selectedIndices={selectedIndices}
          hiddenClusterIds={hiddenClusterIds}
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

// ── Sidebar: Color mode + Legend + Inspector + Stats ─────────────────

interface SidebarProps {
  points: LandscapePoint[];
  clusters: LandscapeCluster[];
  stats: LandscapeResult["stats"];
  colorMode: ColorMode;
  onColorModeChange: (m: ColorMode) => void;
  hiddenClusterIds: Set<number>;
  onToggleCluster: (id: number) => void;
  selectedIndices: Set<number>;
  onClearSelection: () => void;
  onRemoveFromSelection: (index: number) => void;
  cohortCount: number;
}

function Sidebar({
  points,
  clusters,
  stats,
  colorMode,
  onColorModeChange,
  hiddenClusterIds,
  onToggleCluster,
  selectedIndices,
  onClearSelection,
  onRemoveFromSelection,
  cohortCount,
}: SidebarProps) {
  const { t } = useTranslation("app");
  const selectedList = useMemo(
    () =>
      Array.from(selectedIndices)
        .map((idx) => ({ idx, point: points[idx] }))
        .filter((x) => x.point !== undefined),
    [selectedIndices, points],
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border-default bg-surface-base">
      {/* Color mode */}
      <div className="space-y-1.5 border-b border-border-default p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("patientSimilarity.landscape.colorBy")}
        </h4>
        <div className="flex rounded border border-border-default bg-surface-base p-0.5">
          {(["cohort", "cluster"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onColorModeChange(mode)}
              className="flex-1 rounded px-2 py-1 text-xs font-medium transition-colors"
              style={
                colorMode === mode
                  ? { background: ACCENT_BG, color: ACCENT_COLOR }
                  : { color: "var(--text-ghost)" }
              }
            >
              {mode === "cohort"
                ? t("patientSimilarity.landscape.cohort")
                : t("patientSimilarity.landscape.cluster")}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-1 border-b border-border-default p-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {colorMode === "cohort"
            ? t("patientSimilarity.landscape.groups")
            : t("patientSimilarity.landscape.clusters")}
        </h4>
        {colorMode === "cohort" ? (
          <>
            <div className="flex items-center gap-2 px-1.5 py-1 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: CLUSTER_PALETTE[0] }}
              />
              <span className="flex-1 text-text-secondary">
                {t("patientSimilarity.landscape.cohortMembers")}
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                {cohortCount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 px-1.5 py-1 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: CLUSTER_PALETTE[1] }}
              />
              <span className="flex-1 text-text-secondary">
                {t("patientSimilarity.landscape.nonMembers")}
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                {(points.length - cohortCount).toLocaleString()}
              </span>
            </div>
          </>
        ) : (
          clusters.map((c) => {
            const hidden = hiddenClusterIds.has(c.id);
            return (
              <div
                key={c.id}
                className={`flex items-start gap-2 rounded px-1.5 py-1 transition-opacity ${
                  hidden ? "opacity-40" : "opacity-100"
                }`}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background: CLUSTER_PALETTE[c.id % CLUSTER_PALETTE.length],
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-secondary">
                    {c.label ?? `Cluster ${c.id}`}
                  </div>
                  <div className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                    {c.size.toLocaleString()} pts
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleCluster(c.id)}
                  className="rounded border border-border-default px-2 py-0.5 text-[11px] text-text-muted hover:bg-surface-raised hover:text-text-secondary"
                >
                  {hidden
                    ? t("patientSimilarity.landscape.show")
                    : t("patientSimilarity.landscape.hide")}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Inspector */}
      <div className="flex-1 space-y-2 border-b border-border-default p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t("patientSimilarity.landscape.inspector")}
          </h4>
          {selectedList.length > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-surface-raised hover:text-text-secondary"
            >
              {t("patientSimilarity.landscape.clearSelection", {
                count: selectedList.length,
              })}
            </button>
          )}
        </div>
        {selectedList.length === 0 ? (
          <div className="text-sm text-text-ghost">
            {t("patientSimilarity.landscape.clickToInspect")}
          </div>
        ) : (
          <div className="space-y-2">
            {selectedList.map(({ idx, point }) => {
              const cluster = clusters.find((c) => c.id === point.cluster_id);
              return (
                <div
                  key={idx}
                  className="rounded border border-border-default bg-surface-base p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="font-['IBM_Plex_Mono',monospace] text-xs"
                      style={{ color: ACCENT_COLOR }}
                    >
                      {t("patientSimilarity.common.personLabel", {
                        id: point.person_id,
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFromSelection(idx)}
                      className="rounded p-0.5 text-text-ghost hover:bg-surface-raised hover:text-text-secondary"
                      title={t("patientSimilarity.landscape.removeFromSelection")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">
                        {t("patientSimilarity.landscape.ageBucket")}
                      </span>
                      {""}
                      <span className="text-text-secondary">
                        {ageBucketLabel(point.age_bucket)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">{t("patientSimilarity.landscape.pointGender")}</span>
                      <span className="text-text-secondary">
                        {genderLabel(point.gender_concept_id)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">{t("patientSimilarity.landscape.pointCluster")}</span>
                      <span className="text-text-secondary">
                        {cluster?.label ?? `#${point.cluster_id}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">{t("patientSimilarity.landscape.pointCohort")}</span>
                      <span
                        className="text-text-secondary"
                        style={
                          point.is_cohort_member
                            ? { color: ACCENT_COLOR }
                            : undefined
                        }
                      >
                        {point.is_cohort_member
                          ? t("patientSimilarity.landscape.member")
                          : t("patientSimilarity.landscape.nonMember")}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                    ({point.x.toFixed(3)}, {point.y.toFixed(3)}
                    {point.z != null ? `, ${point.z.toFixed(3)}` : ""})
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="space-y-1 p-4">
        <div className="flex justify-between text-xs">
          <span className="text-text-ghost">
            {t("patientSimilarity.landscape.points")}
          </span>
          {""}
          <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
            {points.length.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-text-ghost">{t("patientSimilarity.landscape.clusters")}</span>
          <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
            {clusters.length}
          </span>
        </div>
        {stats?.projection_time_ms != null && stats.projection_time_ms > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-text-ghost">{t("patientSimilarity.landscape.projection")}</span>
            <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
              {(stats.projection_time_ms / 1000).toFixed(1)}s
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function PatientLandscape({
  points,
  clusters,
  stats,
  onPatientClick,
}: PatientLandscapeProps) {
  const { t } = useTranslation("app");
  const [dimensions, setDimensions] = useState<2 | 3>(3);
  const [colorMode, setColorMode] = useState<ColorMode>("cohort");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [hiddenClusterIds, setHiddenClusterIds] = useState<Set<number>>(
    new Set(),
  );
  const [isExpanded, setIsExpanded] = useState(false);

  const is2D = dimensions === 2;
  const cohortCount = useMemo(
    () => points.filter((p) => p.is_cohort_member).length,
    [points],
  );

  const handleClick = useCallback(
    (index: number, multi: boolean) => {
      setSelectedIndices((prev) => {
        const next = new Set(multi ? prev : []);
        if (prev.has(index) && multi) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
      const p = points[index];
      if (p && onPatientClick) onPatientClick(p.person_id);
    },
    [points, onPatientClick],
  );

  const handleToggleCluster = useCallback((id: number) => {
    setHiddenClusterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => setSelectedIndices(new Set()), []);

  const handleRemoveFromSelection = useCallback((idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setHoveredIndex(null);
    setSelectedIndices(new Set());
    setHiddenClusterIds(new Set());
  }, []);

  const sceneContent = (
    <Scene
      points={points}
      clusters={clusters}
      colorMode={colorMode}
      is2D={is2D}
      hoveredIndex={hoveredIndex}
      selectedIndices={selectedIndices}
      hiddenClusterIds={hiddenClusterIds}
      onHover={setHoveredIndex}
      onClick={handleClick}
      autoRotateDisabled={isExpanded}
    />
  );

  const header = (
    <div className="flex items-center justify-between border-b border-border-default bg-surface-base px-4 py-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("patientSimilarity.landscape.title", { count: dimensions })}
        </h3>
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
          onClick={handleReset}
          title={t("patientSimilarity.landscape.resetView")}
          className="rounded p-1 text-text-muted hover:bg-surface-raised hover:text-text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          title={
            isExpanded
              ? t("patientSimilarity.landscape.collapse")
              : t("patientSimilarity.landscape.expand")
          }
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

  const sidebar = (
    <Sidebar
      points={points}
      clusters={clusters}
      stats={stats}
      colorMode={colorMode}
      onColorModeChange={setColorMode}
      hiddenClusterIds={hiddenClusterIds}
      onToggleCluster={handleToggleCluster}
      selectedIndices={selectedIndices}
      onClearSelection={handleClearSelection}
      onRemoveFromSelection={handleRemoveFromSelection}
      cohortCount={cohortCount}
    />
  );

  if (isExpanded) {
    return createPortal(
      <div
        className="fixed inset-0 flex flex-col bg-surface-darkest"
        style={{ zIndex: 200 }}
      >
        {header}
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0">{sceneContent}</div>
          {sidebar}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-surface-base">
      {header}
      <div className="flex" style={{ height: 560 }}>
        <div className="flex-1 min-w-0 relative">{sceneContent}</div>
        {sidebar}
      </div>
    </div>
  );
}
