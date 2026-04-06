import { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ProjectedPoint3D, ClusterInfo } from "../../api/chromaStudioApi";
import {
  SCENE_BG,
  POINT_RADIUS,
  POINT_SEGMENTS,
  HOVER_SCALE,
  QUALITY_COLORS,
  type CollectionTheme,
  type ExplorerMode,
} from "./constants";

interface ThreeSceneProps {
  points: ProjectedPoint3D[];
  clusters: ClusterInfo[];
  collectionTheme: CollectionTheme;
  activeMode: ExplorerMode;
  colorField: string | null;
  hoveredPoint: string | null;
  selectedPoints: Set<string>;
  clusterVisibility: Map<number, boolean>;
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
  outlierIds: Set<string>;
  duplicateIds: Set<string>;
  orphanIds: Set<string>;
  isExpanded: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string, multi: boolean) => void;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

function PointCloud({
  points,
  clusters,
  collectionTheme,
  activeMode,
  colorField,
  hoveredPoint,
  selectedPoints,
  clusterVisibility,
  qaLayers,
  outlierIds,
  duplicateIds,
  orphanIds,
  onHover,
  onSelect,
}: Omit<ThreeSceneProps, "isExpanded">) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorArray = useMemo(() => new Float32Array(points.length * 3), [points.length]);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);

  // Suppress unused variable warning — clusters prop is available for future use
  void clusters;

  // Create color attribute once, recreate only when point count changes
  useEffect(() => {
    if (!meshRef.current) return;
    const attr = new THREE.InstancedBufferAttribute(colorArray, 3);
    meshRef.current.geometry.setAttribute("color", attr);
    colorAttrRef.current = attr;
  }, [colorArray]);

  // Update instance matrices and colors each frame
  useFrame(() => {
    if (!meshRef.current || !colorAttrRef.current) return;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const isHovered = hoveredPoint === p.id;
      const isSelected = selectedPoints.has(p.id);
      const scale = isHovered || isSelected ? HOVER_SCALE : 1;

      tempObject.position.set(p.x, p.y, p.z);
      tempObject.scale.setScalar(scale);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);

      // Color based on mode — uses cluster_id from server (not recomputed)
      let color = "#5A5650";

      if (activeMode === "clusters") {
        const visible = clusterVisibility.get(p.cluster_id) ?? true;
        color = collectionTheme.palette[p.cluster_id % collectionTheme.palette.length];
        if (!visible) color = "#1a1a1f";
      } else if (activeMode === "qa") {
        if (outlierIds.has(p.id) && qaLayers.outliers) {
          color = QUALITY_COLORS.outlier;
        } else if (duplicateIds.has(p.id) && qaLayers.duplicates) {
          color = QUALITY_COLORS.duplicate;
        } else if (orphanIds.has(p.id) && qaLayers.orphans) {
          color = QUALITY_COLORS.orphan;
        } else {
          color = QUALITY_COLORS.normal;
        }
      }

      // Color field override
      if (colorField && p.metadata[colorField] !== undefined) {
        const val = String(p.metadata[colorField]);
        let hash = 0;
        for (let c = 0; c < val.length; c++) {
          hash = val.charCodeAt(c) + ((hash << 5) - hash);
        }
        color = collectionTheme.palette[Math.abs(hash) % collectionTheme.palette.length];
      }

      tempColor.set(color);
      colorArray[i * 3] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    colorAttrRef.current.needsUpdate = true;
  });

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        onHover(points[e.instanceId].id);
      }
    },
    [points, onHover],
  );

  const handlePointerOut = useCallback(() => {
    onHover(null);
  }, [onHover]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        onSelect(points[e.instanceId].id, e.shiftKey);
      }
    },
    [points, onSelect],
  );

  if (points.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, points.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <sphereGeometry args={[POINT_RADIUS, POINT_SEGMENTS, POINT_SEGMENTS]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

export default function ThreeScene(props: ThreeSceneProps) {
  const { isExpanded, ...cloudProps } = props;

  return (
    <Canvas
      camera={{ position: [2, 2, 2], fov: 50 }}
      style={{ background: SCENE_BG }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.8} />
      <PointCloud {...cloudProps} />
      <OrbitControls
        autoRotate={!isExpanded}
        autoRotateSpeed={0.5}
        enablePan={isExpanded}
        dampingFactor={0.1}
        enableDamping
      />
      {props.hoveredPoint && (() => {
        const point = props.points.find((p) => p.id === props.hoveredPoint);
        if (!point) return null;
        return (
          <Html
            position={[point.x, point.y + 0.15, point.z]}
            center
            zIndexRange={[100, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className="pointer-events-none whitespace-nowrap rounded bg-[#151518]/95 px-2 py-1 text-xs shadow-xl backdrop-blur"
              style={{ border: `1px solid ${props.collectionTheme.border}` }}
            >
              <div className="font-['IBM_Plex_Mono',monospace]" style={{ color: props.collectionTheme.accent }}>
                {point.id}
              </div>
              {Object.entries(point.metadata).slice(0, 3).map(([k, v]) => (
                <div key={k} className="text-[#8A857D]">
                  {k}: <span className="text-[#C5C0B8]">{String(v)}</span>
                </div>
              ))}
            </div>
          </Html>
        );
      })()}
    </Canvas>
  );
}
