import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ConvexGeometry } from "three-stdlib";
import type { ClusterInfo, ProjectedPoint3D } from "../../api/chromaStudioApi";
import type { CollectionTheme } from "./constants";

interface ClusterHullsProps {
  points: ProjectedPoint3D[];
  clusters: ClusterInfo[];
  collectionTheme: CollectionTheme;
}

const MIN_POINTS_FOR_HULL = 8;
const MAX_POINTS_PER_HULL = 96;
const ignoreRaycast: THREE.Object3D["raycast"] = () => {};

function selectHullPoints(points: ProjectedPoint3D[], centroid: [number, number, number]): ProjectedPoint3D[] {
  if (points.length <= MAX_POINTS_PER_HULL) {
    return points;
  }

  const ranked = [...points]
    .map((point) => {
      const dx = point.x - centroid[0];
      const dy = point.y - centroid[1];
      const dz = point.z - centroid[2];
      return {
        point,
        distance: dx * dx + dy * dy + dz * dz,
      };
    })
    .sort((a, b) => b.distance - a.distance);

  const stride = Math.max(1, Math.floor(ranked.length / MAX_POINTS_PER_HULL));
  const selected: ProjectedPoint3D[] = [];

  for (let index = 0; index < ranked.length && selected.length < MAX_POINTS_PER_HULL; index += stride) {
    selected.push(ranked[index].point);
  }

  return selected;
}

export default function ClusterHulls({
  points,
  clusters,
  collectionTheme,
}: ClusterHullsProps) {
  const hulls = useMemo(() => {
    const grouped = new Map<number, ProjectedPoint3D[]>();

    for (const point of points) {
      const bucket = grouped.get(point.cluster_id);
      if (bucket) {
        bucket.push(point);
      } else {
        grouped.set(point.cluster_id, [point]);
      }
    }

    const built: Array<{ id: number; geometry: THREE.BufferGeometry; color: string }> = [];

    for (const cluster of clusters) {
      const clusterPoints = grouped.get(cluster.id) ?? [];
      if (clusterPoints.length < MIN_POINTS_FOR_HULL) {
        continue;
      }

      const hullPoints = selectHullPoints(clusterPoints, cluster.centroid);
      if (hullPoints.length < 4) {
        continue;
      }

      try {
        const geometry = new ConvexGeometry(
          hullPoints.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
        );
        built.push({
          id: cluster.id,
          geometry,
          color: collectionTheme.palette[cluster.id % collectionTheme.palette.length],
        });
      } catch {
        // Convex hull construction can fail for degenerate point sets.
      }
    }

    return built;
  }, [points, clusters, collectionTheme]);

  useEffect(() => {
    return () => {
      hulls.forEach((hull) => hull.geometry.dispose());
    };
  }, [hulls]);

  return (
    <group renderOrder={-1}>
      {hulls.map((hull) => (
        <mesh key={hull.id} geometry={hull.geometry} raycast={ignoreRaycast}>
          <meshBasicMaterial
            color={hull.color}
            transparent
            opacity={0.08}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
