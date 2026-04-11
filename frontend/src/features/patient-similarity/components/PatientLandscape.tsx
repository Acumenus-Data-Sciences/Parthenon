import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { Layers, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LandscapePoint, LandscapeCluster, LandscapeResult } from "../types/patientSimilarity";

// ── Constants ────────────────────────────────────────────────────────

const SCENE_BG = "#0E0E11";
const TEAL = "#2DD4BF";
const GRAY = "#4B5563";
const CLUSTER_PALETTE = [
  "#2DD4BF", "#C9A227", "#9B1B30", "#6366F1", "#EC4899",
  "#22D3EE", "#A78BFA", "#F97316", "#84CC16", "#F43F5E",
];

const GENDER_LABELS: Record<number, string> = {
  8507: "Male",
  8532: "Female",
};

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

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
  const count = points.length;

  const { colorArray } = useMemo(() => {
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = points[i];
      let hex: string;
      if (colorByCluster) {
        hex = CLUSTER_PALETTE[p.cluster_id % CLUSTER_PALETTE.length];
      } else {
        hex = p.is_cohort_member ? TEAL : GRAY;
      }
      tempColor.set(hex);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }
    return { colorArray: colors };
  }, [points, colorByCluster, count]);

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
      <sphereGeometry args={[0.015, 8, 8]}>
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
      <div className="rounded-lg border border-[#2A2A2E] bg-[#151518]/95 px-3 py-2 text-xs text-gray-300 shadow-xl backdrop-blur-sm whitespace-nowrap">
        <div className="font-semibold text-[#F0EDE8]">
          Person {point.person_id}
        </div>
        <div className="mt-1 space-y-0.5">
          <div>
            Age bucket: <span className="text-[#C9A227]">{point.age_bucket}</span>
          </div>
          <div>
            Gender:{" "}
            <span className="text-[#2DD4BF]">
              {GENDER_LABELS[point.gender_concept_id] ?? `ID ${point.gender_concept_id}`}
            </span>
          </div>
          {cluster && (
            <div>
              Cluster: <span className="text-[#C5C0B8]">{cluster.label ?? `#${cluster.id}`}</span>
            </div>
          )}
          {point.is_cohort_member && (
            <div className="text-[#2DD4BF] font-medium">Cohort member</div>
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
    <div className="flex flex-col rounded-lg border border-[#2A2A2E] bg-[#151518] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[#232328] px-4 py-2">
        <div className="flex items-center gap-4">
          {/* 2D / 3D toggle */}
          <div className="flex rounded border border-[#2A2A2E] overflow-hidden">
            <button
              type="button"
              onClick={() => setIs2D(false)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                !is2D
                  ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                  : "bg-[#0E0E11] text-[#5A5650] hover:text-[#C5C0B8]",
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
                  ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                  : "bg-[#0E0E11] text-[#5A5650] hover:text-[#C5C0B8]",
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
                ? "border-[#C9A227]/30 text-[#C9A227] bg-[#C9A227]/10"
                : "border-[#2A2A2E] text-[#5A5650] hover:text-[#C5C0B8]",
            )}
          >
            {colorByCluster ? "Cluster colors" : "Cohort colors"}
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-[#5A5650]">
          <span>
            <span className="text-[#C5C0B8] font-medium">
              {points.length.toLocaleString()}
            </span>{" "}
            patients projected
          </span>
          {stats?.projection_time_ms != null && stats.projection_time_ms > 0 && (
            <span>
              in{" "}
              <span className="text-[#C5C0B8]">
                {(stats.projection_time_ms / 1000).toFixed(1)}s
              </span>
            </span>
          )}
          {clusters.length > 0 && (
            <span>
              <span className="text-[#C9A227]">{clusters.length}</span> clusters
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
      <div className="flex items-center gap-6 border-t border-[#232328] px-4 py-2 text-xs text-[#5A5650]">
        {!colorByCluster ? (
          <>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: TEAL }}
              />
              Cohort members ({cohortCount.toLocaleString()})
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: GRAY }}
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
                  background: CLUSTER_PALETTE[c.id % CLUSTER_PALETTE.length],
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
