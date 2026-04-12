import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { Layers, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";
import type { LandscapePoint, LandscapeCluster, LandscapeResult } from "../types/patientSimilarity";

// ── Constants ────────────────────────────────────────────────────────

const SCENE_BG = "var(--color-surface-base)";
const COHORT_COLOR = "var(--color-primary)";
const NON_MEMBER_COLOR = "var(--color-text-muted)";
const CLUSTER_COLOR_VARS = [
  ["--primary", "#7A1526"],
  ["--accent", "#8B7018"],
  ["--critical", "#C93545"],
  ["--chart-4", "#7C3AED"],
  ["--domain-procedure", "#DB2777"],
  ["--info", "#2563EB"],
  ["--domain-observation", "#7C3AED"],
  ["--domain-device", "#EA580C"],
  ["--chart-5", "#8B7018"],
  ["--chart-8", "#C93545"],
];

const GENDER_LABELS: Record<number, string> = {
  8507: "Male",
  8532: "Female",
};

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

function resolveCssColor(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// ── Props ────────────────────────────────────────────────────────────

interface PatientLandscapeProps {
  points: LandscapePoint[];
  clusters: LandscapeCluster[];
  stats: LandscapeResult["stats"];
  onPatientClick?: (personId: number) => void;
}

// ── Instanced Points Component ───────────────────────────────────────

interface PointCloudProps {
  points: LandscapePoint[];
  colorByCluster: boolean;
  is2D: boolean;
  onHover: (index: number | null) => void;
  onClick: (index: number) => void;
}

function PointCloud({ points, colorByCluster, is2D, onHover, onClick }: PointCloudProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const theme = useThemeStore((state) => state.theme);
  const count = points.length;
  const resolvedColors = useMemo(() => {
    const cohort = resolveCssColor("--primary", "#7A1526");
    const nonMember = resolveCssColor("--text-muted", "#6D6860");
    const clusters = CLUSTER_COLOR_VARS.map(([name, fallback]) =>
      resolveCssColor(name, fallback),
    );
    return { cohort, nonMember, clusters };
  }, [theme]);

  const { colorArray } = useMemo(() => {
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = points[i];
      let hex: string;
      if (colorByCluster) {
        hex = resolvedColors.clusters[p.cluster_id % resolvedColors.clusters.length];
      } else {
        hex = p.is_cohort_member ? resolvedColors.cohort : resolvedColors.nonMember;
      }
      tempColor.set(hex);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }
    return { colorArray: colors };
  }, [points, colorByCluster, count, resolvedColors]);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    for (let i = 0; i < count; i++) {
      const p = points[i];
      tempObject.position.set(p.x, p.y, is2D ? 0 : (p.z ?? 0));
      tempObject.scale.setScalar(1);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const attr = mesh.geometry.getAttribute("color") as THREE.InstancedBufferAttribute | undefined;
    if (attr) {
      attr.set(colorArray);
      attr.needsUpdate = true;
    }
  }, [points, colorArray, is2D, count]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        onHover(e.instanceId);
      }
    },
    [onHover],
  );

  const handlePointerOut = useCallback(() => {
    onHover(null);
  }, [onHover]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        onClick(e.instanceId);
      }
    },
    [onClick],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <sphereGeometry args={[0.025, 8, 8]}>
        <instancedBufferAttribute
          attach="attributes-color"
          args={[colorArray, 3]}
        />
      </sphereGeometry>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

// ── Tooltip Component ────────────────────────────────────────────────

interface TooltipProps {
  point: LandscapePoint;
  clusters: LandscapeCluster[];
  is2D: boolean;
}

function PointTooltip({ point, clusters, is2D }: TooltipProps) {
  const cluster = clusters.find((c) => c.id === point.cluster_id);
  return (
    <Html
      position={[point.x, point.y, is2D ? 0 : (point.z ?? 0)]}
      center
      style={{ pointerEvents: "none" }}
    >
      <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)]/95 px-3 py-2 text-xs text-[var(--color-text-secondary)] shadow-xl backdrop-blur-sm whitespace-nowrap">
        <div className="font-semibold text-[var(--color-text-primary)]">
          Person {point.person_id}
        </div>
        <div className="mt-1 space-y-0.5">
          <div>
            Age bucket: <span className="text-[var(--color-primary)]">{point.age_bucket}</span>
          </div>
          <div>
            Gender:{" "}
            <span className="text-[var(--color-primary)]">
              {GENDER_LABELS[point.gender_concept_id] ?? `ID ${point.gender_concept_id}`}
            </span>
          </div>
          {cluster && (
            <div>
              Cluster: <span className="text-[var(--color-text-primary)]">{cluster.label ?? `#${cluster.id}`}</span>
            </div>
          )}
          {point.is_cohort_member && (
            <div className="text-[var(--color-primary)] font-medium">Cohort member</div>
          )}
        </div>
      </div>
    </Html>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function PatientLandscape({
  points,
  clusters,
  stats,
  onPatientClick,
}: PatientLandscapeProps) {
  const [is2D, setIs2D] = useState(false);
  const [colorByCluster, setColorByCluster] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;
  const cohortCount = useMemo(
    () => points.filter((p) => p.is_cohort_member).length,
    [points],
  );

  const handleClick = useCallback(
    (index: number) => {
      const p = points[index];
      if (p && onPatientClick) {
        onPatientClick(p.person_id);
      }
    },
    [points, onPatientClick],
  );

  return (
    <div className="flex flex-col rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-surface-overlay)] px-4 py-2">
        <div className="flex items-center gap-4">
          {/* 2D / 3D toggle */}
          <div className="flex rounded border border-[var(--color-surface-overlay)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIs2D(false)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                !is2D
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "bg-[var(--color-surface-base)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <Layers size={12} className="inline mr-1" />
              3D
            </button>
            <button
              type="button"
              onClick={() => setIs2D(true)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                is2D
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "bg-[var(--color-surface-base)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <Grid3X3 size={12} className="inline mr-1" />
              2D
            </button>
          </div>

          {/* Cluster color toggle */}
          <button
            type="button"
            onClick={() => setColorByCluster((v) => !v)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded border transition-colors",
              colorByCluster
                ? "border-[var(--color-primary)]/30 text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                : "border-[var(--color-surface-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {colorByCluster ? "Cluster colors" : "Cohort colors"}
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <span>
            <span className="text-[var(--color-text-primary)] font-medium">
              {points.length.toLocaleString()}
            </span>{" "}
            patients projected
          </span>
          {stats?.projection_time_ms != null && stats.projection_time_ms > 0 && (
            <span>
              in{" "}
              <span className="text-[var(--color-text-primary)]">
                {(stats.projection_time_ms / 1000).toFixed(1)}s
              </span>
            </span>
          )}
          {clusters.length > 0 && (
            <span>
              <span className="text-[var(--color-primary)]">{clusters.length}</span> clusters
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ height: 560 }}>
        <Canvas
          camera={{
            position: is2D ? [0, 0, 2.5] : [1.5, 1.5, 1.5],
            fov: 50,
            near: 0.01,
            far: 100,
          }}
          style={{ background: SCENE_BG }}
          gl={{ antialias: true }}
        >
          <ambientLight intensity={1} />
          <PointCloud
            points={points}
            colorByCluster={colorByCluster}
            is2D={is2D}
            onHover={setHoveredIndex}
            onClick={handleClick}
          />
          {hoveredPoint && (
            <PointTooltip
              point={hoveredPoint}
              clusters={clusters}
              is2D={is2D}
            />
          )}
          <OrbitControls
            enableRotate={!is2D}
            enablePan
            enableZoom
            makeDefault
          />
        </Canvas>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 border-t border-[var(--color-surface-overlay)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
        {!colorByCluster ? (
          <>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: COHORT_COLOR }}
              />
              Cohort members ({cohortCount.toLocaleString()})
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: NON_MEMBER_COLOR }}
              />
              Non-members ({(points.length - cohortCount).toLocaleString()})
            </div>
          </>
        ) : (
          clusters.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  background: `var(${CLUSTER_COLOR_VARS[c.id % CLUSTER_COLOR_VARS.length][0]})`,
                }}
              />
              {c.label ?? `Cluster ${c.id}`} ({c.size})
            </div>
          ))
        )}
      </div>
    </div>
  );
}
