import { useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ProjectedPoint3D, QueryResultItem } from "../../api/chromaStudioApi";
import { SIMILARITY_GRADIENT } from "./constants";

interface QueryVisualsProps {
  points: ProjectedPoint3D[];
  results: QueryResultItem[];
  accentColor: string;
}

const ignoreRaycast: THREE.Object3D["raycast"] = () => {};

function similarityFromDistance(distance: number | null | undefined): number {
  if (distance === null || distance === undefined || Number.isNaN(distance)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, 1 - distance));
}

function colorForSimilarity(similarity: number): THREE.Color {
  const low = new THREE.Color(SIMILARITY_GRADIENT.low);
  const mid = new THREE.Color(SIMILARITY_GRADIENT.mid);
  const high = new THREE.Color(SIMILARITY_GRADIENT.high);

  if (similarity < 0.5) {
    return low.lerp(mid, similarity / 0.5);
  }
  return mid.lerp(high, (similarity - 0.5) / 0.5);
}

export default function QueryVisuals({
  points,
  results,
  accentColor,
}: QueryVisualsProps) {
  const visible = useMemo(() => {
    const pointMap = new Map(points.map((point) => [point.id, point]));

    return results
      .map((result) => {
        const point = pointMap.get(result.id);
        if (!point) {
          return null;
        }
        return {
          point,
          similarity: similarityFromDistance(result.distance),
        };
      })
      .filter((entry): entry is { point: ProjectedPoint3D; similarity: number } => entry !== null);
  }, [points, results]);

  const geometry = useMemo(() => {
    if (visible.length === 0) {
      return null;
    }

    const totalWeight = visible.reduce((sum, entry) => sum + Math.max(entry.similarity, 0.15), 0);
    const anchor = visible.reduce(
      (acc, entry) => {
        const weight = Math.max(entry.similarity, 0.15);
        acc.x += entry.point.x * weight;
        acc.y += entry.point.y * weight;
        acc.z += entry.point.z * weight;
        return acc;
      },
      { x: 0, y: 0, z: 0 },
    );

    anchor.x /= totalWeight;
    anchor.y = anchor.y / totalWeight + 0.16;
    anchor.z = anchor.z / totalWeight;

    const positions = new Float32Array(visible.length * 6);
    const colors = new Float32Array(visible.length * 6);

    visible.forEach((entry, index) => {
      const offset = index * 6;
      positions[offset] = anchor.x;
      positions[offset + 1] = anchor.y;
      positions[offset + 2] = anchor.z;
      positions[offset + 3] = entry.point.x;
      positions[offset + 4] = entry.point.y;
      positions[offset + 5] = entry.point.z;

      const color = colorForSimilarity(entry.similarity);
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
      colors[offset + 3] = color.r;
      colors[offset + 4] = color.g;
      colors[offset + 5] = color.b;
    });

    return { anchor, positions, colors };
  }, [visible]);

  if (!geometry) {
    return null;
  }

  return (
    <group>
      <lineSegments renderOrder={1} raycast={ignoreRaycast}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[geometry.positions, 3]}
            count={geometry.positions.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[geometry.colors, 3]}
            count={geometry.colors.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.75} toneMapped={false} />
      </lineSegments>

      <mesh
        position={[geometry.anchor.x, geometry.anchor.y, geometry.anchor.z]}
        renderOrder={2}
        raycast={ignoreRaycast}
      >
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={accentColor} toneMapped={false} />
      </mesh>

      <Html
        position={[geometry.anchor.x, geometry.anchor.y + 0.12, geometry.anchor.z]}
        center
        zIndexRange={[100, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="rounded border border-[#232328] bg-[#151518]/95 px-2 py-1 text-xs text-[#C5C0B8] shadow-xl backdrop-blur">
          Query anchor
        </div>
      </Html>
    </group>
  );
}
