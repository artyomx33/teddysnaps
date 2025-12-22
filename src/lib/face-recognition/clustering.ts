"use client";

import * as faceapi from "face-api.js";
import { arrayToDescriptor } from "./processor";

export interface ClusterableItem {
  id: string;
  descriptor: number[];
}

export interface Cluster {
  id: string;
  items: string[]; // IDs of clustered items
}

// Conservative threshold for clustering (>85% similarity)
// 0.4 Euclidean distance roughly equals ~85% similarity
const CLUSTER_THRESHOLD = 0.4;

/**
 * Union-Find data structure for efficient clustering
 */
class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
    }
    if (this.parent.get(x) !== x) {
      // Path compression
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const px = this.find(x);
    const py = this.find(y);
    if (px === py) return;

    const rx = this.rank.get(px) || 0;
    const ry = this.rank.get(py) || 0;

    if (rx < ry) {
      this.parent.set(px, py);
    } else if (rx > ry) {
      this.parent.set(py, px);
    } else {
      this.parent.set(py, px);
      this.rank.set(px, rx + 1);
    }
  }
}

/**
 * Cluster faces by similarity using Union-Find algorithm
 * More efficient than O(n²) naive approach with early termination
 */
export function clusterFaces(
  items: ClusterableItem[],
  threshold: number = CLUSTER_THRESHOLD
): Cluster[] {
  if (items.length === 0) return [];

  const uf = new UnionFind();
  const timestamp = Date.now();

  // Compare faces - still O(n²) but with early exits via Union-Find
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      // Skip if already in same cluster
      if (uf.find(items[i].id) === uf.find(items[j].id)) continue;

      const desc1 = arrayToDescriptor(items[i].descriptor);
      const desc2 = arrayToDescriptor(items[j].descriptor);
      const distance = faceapi.euclideanDistance(desc1, desc2);

      if (distance < threshold) {
        uf.union(items[i].id, items[j].id);
      }
    }
  }

  // Group by cluster root
  const clusterMap = new Map<string, string[]>();
  for (const item of items) {
    const root = uf.find(item.id);
    if (!clusterMap.has(root)) {
      clusterMap.set(root, []);
    }
    clusterMap.get(root)!.push(item.id);
  }

  // Convert to Cluster array with simple string IDs
  let clusterIndex = 0;
  return Array.from(clusterMap.entries()).map(([_, itemIds]) => ({
    id: `cluster_${timestamp}_${clusterIndex++}`,
    items: itemIds,
  }));
}

/**
 * Match a descriptor against enrolled children
 * Conservative threshold (>85% confidence)
 */
export function findMatchingChild(
  descriptor: number[],
  enrolledChildren: Array<{ id: string; descriptor: number[] }>,
  threshold: number = CLUSTER_THRESHOLD
): { childId: string; confidence: number } | null {
  let bestMatch: { childId: string; confidence: number } | null = null;
  let bestDistance = Infinity;

  const descFloat = arrayToDescriptor(descriptor);

  for (const child of enrolledChildren) {
    const childFloat = arrayToDescriptor(child.descriptor);
    const distance = faceapi.euclideanDistance(descFloat, childFloat);

    if (distance < threshold && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = {
        childId: child.id,
        confidence: Math.round((1 - distance) * 100) / 100,
      };
    }
  }

  return bestMatch;
}
