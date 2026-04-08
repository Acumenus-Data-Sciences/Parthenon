import { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ProjectedPoint3D, ClusterInfo, ProjectionEdge, QueryResultItem } from "../../api/chromaStudioApi";
import {
  SCENE_BG,
  POINT_RADIUS,
  POINT_SEGMENTS,
  HOVER_SCALE,
  QUALITY_COLORS,
  SIMILARITY_GRADIENT,
  type CollectionTheme,
  type ExplorerMode,
} from "./constants";
import QueryVisuals from "./QueryVisuals";
import ClusterHulls from "./ClusterHulls";

interface ThreeSceneProps {
  points: ProjectedPoint3D[];
  edges: ProjectionEdge[];
  clusters: ClusterInfo[];
  collectionTheme: CollectionTheme;
  activeMode: ExplorerMode;
  colorField: string | null;
  hoveredPoint: string | null;
  selectedPoints: Set<string>;
  overlayVisibility: { hulls: boolean; topology: boolean; queryRays: boolean };
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
  outlierIds: Set<string>;
  duplicateIds: Set<string>;
  orphanIds: Set<string>;
  queryItems: QueryResultItem[];
  isExpanded: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string, multi: boolean) => void;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const ignoreRaycast: THREE.Object3D["raycast"] = () => {};

function similarityFromDistance(distance: number | null | undefined): number {
  if (distance === null || distance === undefined || Number.isNaN(distance)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, 1 - distance));
}

function getSimilarityColor(similarity: number): string {
  const low = new THREE.Color(SIMILARITY_GRADIENT.low);
  const mid = new THREE.Color(SIMILARITY_GRADIENT.mid);
  const high = new THREE.Color(SIMILARITY_GRADIENT.high);

  if (similarity < 0.5) {
    return low.lerp(mid, similarity / 0.5).getStyle();
  }
  return mid.lerp(high, (similarity - 0.5) / 0.5).getStyle();
}

function TopologyLines({
  points,
  edges,
  collectionTheme,
}: Pick<ThreeSceneProps, "points" | "edges" | "collectionTheme">) {
  const topology = useMemo(() => {
    if (points.length < 2) {
      return null;
    }

    const visiblePointMap = new Map(points.map((point) => [point.id, point]));
    const segments: Array<{ a: ProjectedPoint3D; b: ProjectedPoint3D; color: THREE.Color }> = [];

    if (edges.length > 0) {
      for (const edge of edges) {
        const a = visiblePointMap.get(edge.source_id);
        const b = visiblePointMap.get(edge.target_id);
        if (!a || !b) {
          continue;
        }

        const clusterBlend = new THREE.Color(
          collectionTheme.palette[a.cluster_id % collectionTheme.palette.length],
        ).lerp(
          new THREE.Color(collectionTheme.palette[b.cluster_id % collectionTheme.palette.length]),
          0.5,
        );
        const neutral = new THREE.Color("#F0EDE8");
        const similarity = Math.max(0, Math.min(1, edge.similarity));

        segments.push({
          a,
          b,
          color: clusterBlend.lerp(neutral, similarity * 0.35),
        });
      }
    } else {
      const neighborCount =
        points.length > 25000
          ? 2
          : points.length > 10000
            ? 3
            : 4;
      const windowSize =
        points.length > 25000
          ? 20
          : points.length > 10000
            ? 32
            : 48;

      const sorted = [...points].sort((a, b) => a.x - b.x);
      const edgeSet = new Set<string>();

      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const candidates: Array<{ point: ProjectedPoint3D; distance: number }> = [];
        const start = Math.max(0, i - windowSize);
        const end = Math.min(sorted.length - 1, i + windowSize);

        for (let j = start; j <= end; j++) {
          if (j === i) {
            continue;
          }
          const candidate = sorted[j];
          const dx = current.x - candidate.x;
          const dy = current.y - candidate.y;
          const dz = current.z - candidate.z;
          candidates.push({
            point: candidate,
            distance: dx * dx + dy * dy + dz * dz,
          });
        }

        candidates.sort((a, b) => a.distance - b.distance);

        for (let j = 0; j < Math.min(neighborCount, candidates.length); j++) {
          const candidate = candidates[j].point;
          const edgeKey =
            current.id < candidate.id
              ? `${current.id}:${candidate.id}`
              : `${candidate.id}:${current.id}`;
          if (edgeSet.has(edgeKey)) {
            continue;
          }
          edgeSet.add(edgeKey);

          const color = new THREE.Color(
            collectionTheme.palette[current.cluster_id % collectionTheme.palette.length],
          ).lerp(
            new THREE.Color(collectionTheme.palette[candidate.cluster_id % collectionTheme.palette.length]),
            0.5,
          );

          segments.push({
            a: current,
            b: candidate,
            color,
          });
        }
      }
    }

    if (segments.length === 0) {
      return null;
    }

    const positions = new Float32Array(segments.length * 6);
    const colors = new Float32Array(segments.length * 6);

    segments.forEach((segment, index) => {
      const offset = index * 6;
      positions[offset] = segment.a.x;
      positions[offset + 1] = segment.a.y;
      positions[offset + 2] = segment.a.z;
      positions[offset + 3] = segment.b.x;
      positions[offset + 4] = segment.b.y;
      positions[offset + 5] = segment.b.z;

      colors[offset] = segment.color.r;
      colors[offset + 1] = segment.color.g;
      colors[offset + 2] = segment.color.b;
      colors[offset + 3] = segment.color.r;
      colors[offset + 4] = segment.color.g;
      colors[offset + 5] = segment.color.b;
    });

    return { positions, colors };
  }, [points, edges, collectionTheme]);

  if (!topology) {
    return null;
  }

  return (
    <lineSegments renderOrder={0} raycast={ignoreRaycast}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[topology.positions, 3]}
          count={topology.positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[topology.colors, 3]}
          count={topology.colors.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.18} toneMapped={false} />
    </lineSegments>
  );
}

function PointCloud({
  points,
  clusters,
  collectionTheme,
  activeMode,
  colorField,
  hoveredPoint,
  selectedPoints,
  qaLayers,
  outlierIds,
  duplicateIds,
  orphanIds,
  queryItems,
  onHover,
  onSelect,
}: Omit<ThreeSceneProps, "isExpanded">) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const pointIndexMap = useMemo(
    () => new Map(points.map((point, index) => [point.id, index])),
    [points],
  );
  const previousHoveredRef = useRef<string | null>(null);
  const querySimilarityMap = useMemo(() => {
    const next = new Map<string, number>();
    for (const item of queryItems) {
      next.set(item.id, similarityFromDistance(item.distance));
    }
    return next;
  }, [queryItems]);

  // Suppress unused variable warning — clusters prop is available for future use
  void clusters;

  // Create color attribute once, recreate only when point count changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(points.length * 3), 3);
    mesh.geometry.setAttribute("color", attr);
    colorAttrRef.current = attr;
    return () => {
      mesh.geometry.deleteAttribute("color");
      colorAttrRef.current = null;
    };
  }, [points.length]);

  const getPointColor = useCallback((point: ProjectedPoint3D) => {
    let color = "#5A5650";

    if (activeMode === "clusters") {
      color = collectionTheme.palette[point.cluster_id % collectionTheme.palette.length];
    } else if (activeMode === "query") {
      const similarity = querySimilarityMap.get(point.id);
      color = similarity !== undefined ? getSimilarityColor(similarity) : "#1a1a1f";
    } else if (activeMode === "qa") {
      if (outlierIds.has(point.id) && qaLayers.outliers) {
        color = QUALITY_COLORS.outlier;
      } else if (duplicateIds.has(point.id) && qaLayers.duplicates) {
        color = QUALITY_COLORS.duplicate;
      } else if (orphanIds.has(point.id) && qaLayers.orphans) {
        color = QUALITY_COLORS.orphan;
      } else {
        color = QUALITY_COLORS.normal;
      }
    }

    if (colorField && point.metadata[colorField] !== undefined) {
      const val = String(point.metadata[colorField]);
      let hash = 0;
      for (let c = 0; c < val.length; c++) {
        hash = val.charCodeAt(c) + ((hash << 5) - hash);
      }
      color = collectionTheme.palette[Math.abs(hash) % collectionTheme.palette.length];
    }

    return color;
  }, [
    activeMode,
    collectionTheme,
    colorField,
    duplicateIds,
    orphanIds,
    outlierIds,
    qaLayers,
    querySimilarityMap,
  ]);

  const setPointScaleAtIndex = useCallback((index: number, scale: number) => {
    if (!meshRef.current || index < 0 || index >= points.length) {
      return;
    }

    const point = points[index];
    tempObject.position.set(point.x, point.y, point.z);
    tempObject.scale.setScalar(scale);
    tempObject.updateMatrix();
    meshRef.current.setMatrixAt(index, tempObject.matrix);
  }, [points]);

  useEffect(() => {
    if (!meshRef.current || !colorAttrRef.current) return;

    const nextColors = new Float32Array(points.length * 3);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const isSelected = selectedPoints.has(p.id);
      const scale = isSelected ? HOVER_SCALE : 1;

      setPointScaleAtIndex(i, scale);

      const color = getPointColor(p);

      tempColor.set(color);
      nextColors[i * 3] = tempColor.r;
      nextColors[i * 3 + 1] = tempColor.g;
      nextColors[i * 3 + 2] = tempColor.b;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    colorAttrRef.current.copyArray(nextColors);
    colorAttrRef.current.needsUpdate = true;
  }, [
    points,
    selectedPoints,
    getPointColor,
    setPointScaleAtIndex,
  ]);

  useEffect(() => {
    if (!meshRef.current) {
      previousHoveredRef.current = hoveredPoint;
      return;
    }

    const touchedIds = new Set<string>();
    if (previousHoveredRef.current) {
      touchedIds.add(previousHoveredRef.current);
    }
    if (hoveredPoint) {
      touchedIds.add(hoveredPoint);
    }

    if (touchedIds.size === 0) {
      return;
    }

    for (const id of touchedIds) {
      const index = pointIndexMap.get(id);
      if (index === undefined) {
        continue;
      }
      const scale = id === hoveredPoint || selectedPoints.has(id) ? HOVER_SCALE : 1;
      setPointScaleAtIndex(index, scale);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    previousHoveredRef.current = hoveredPoint;
  }, [
    hoveredPoint,
    pointIndexMap,
    points.length,
    selectedPoints,
    setPointScaleAtIndex,
  ]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        const nextHoveredId = points[e.instanceId].id;
        if (nextHoveredId !== hoveredPoint) {
          onHover(nextHoveredId);
        }
      }
    },
    [hoveredPoint, points, onHover],
  );

  const handlePointerOut = useCallback(() => {
    if (hoveredPoint !== null) {
      onHover(null);
    }
  }, [hoveredPoint, onHover]);

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
      {props.activeMode === "clusters" && props.overlayVisibility.hulls && (
        <ClusterHulls
          points={props.points}
          clusters={props.clusters}
          collectionTheme={props.collectionTheme}
        />
      )}
      {props.activeMode === "clusters" && props.overlayVisibility.topology && (
        <TopologyLines
          points={props.points}
          edges={props.edges}
          collectionTheme={props.collectionTheme}
        />
      )}
      {props.activeMode === "query" && props.overlayVisibility.queryRays && (
        <QueryVisuals
          points={props.points}
          results={props.queryItems}
          accentColor={props.collectionTheme.accent}
        />
      )}
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
