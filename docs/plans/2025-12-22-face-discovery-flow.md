# Face Discovery Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an Apple Photos-style face discovery system that automatically detects faces in uploaded photos, clusters them by similarity, and allows bulk naming with pressable buttons.

**Architecture:** Client-side face detection using face-api.js. Faces are discovered during session processing, stored as descriptors with crop thumbnails, then clustered by similarity. Admin bulk-names faces using a grid of faces + pressable name buttons. Photos with faces are automatically assigned to ALL matching children (deduplicated in family view).

**Tech Stack:** face-api.js (already installed), Supabase Storage (face crops), React/Next.js, Framer Motion, existing UI components

---

## Current State Analysis

**Already Built:**
- `src/lib/face-recognition/detector.ts` - Face detection with face-api.js
- `src/lib/face-recognition/matcher.ts` - Face comparison (Euclidean distance)
- `src/lib/face-recognition/processor.ts` - Batch processing with progress
- `src/lib/actions/faces.ts` - Server actions for matches
- `src/components/upload/ai-processor.tsx` - Processing UI component
- `src/types/index.ts` - TypeScript types for Child, Photo, PhotoChild

**What's Missing (This Plan):**
1. Face discovery mode (detect without pre-enrollment)
2. Face crops storage (thumbnails of detected faces)
3. Face clustering (group similar faces together)
4. Bulk naming UI (pressable buttons for existing names + create new + skip)
5. New Faces management page
6. Database schema for discovered faces
7. photo_children records creation on naming
8. Memory-efficient batch processing
9. Undo functionality
10. Keyboard shortcuts for fast workflow

---

## Task 1: Database Schema for Discovered Faces

**Files:**
- Create: `supabase/migrations/004_discovered_faces.sql`

**Step 1: Write the migration**

```sql
-- Migration: Discovered Faces
-- Stores detected faces before they're named/matched

-- Table: discovered_faces
-- Stores face descriptors and crop images from photos
CREATE TABLE discovered_faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES photo_sessions(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,

  -- Face data
  face_descriptor JSONB NOT NULL, -- 128-dimensional float array
  crop_url TEXT NOT NULL, -- URL to cropped face image
  detection_score FLOAT NOT NULL DEFAULT 0.0, -- face-api.js detection confidence

  -- Bounding box (for deduplication)
  bbox_x FLOAT NOT NULL,
  bbox_y FLOAT NOT NULL,
  bbox_width FLOAT NOT NULL,
  bbox_height FLOAT NOT NULL,

  -- Clustering/naming
  cluster_id TEXT, -- Simple string ID (e.g., cluster_1703256000_0)
  child_id UUID REFERENCES children(id) ON DELETE SET NULL, -- NULL until named
  confidence FLOAT, -- Confidence of the name assignment

  -- Status
  is_named BOOLEAN DEFAULT FALSE,
  is_skipped BOOLEAN DEFAULT FALSE, -- For "Not a face" option

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate faces (same bbox in same photo)
CREATE UNIQUE INDEX idx_discovered_faces_unique
ON discovered_faces(photo_id, bbox_x, bbox_y, bbox_width, bbox_height);

-- Indexes for performance
CREATE INDEX idx_discovered_faces_session ON discovered_faces(session_id);
CREATE INDEX idx_discovered_faces_photo ON discovered_faces(photo_id);
CREATE INDEX idx_discovered_faces_cluster ON discovered_faces(cluster_id) WHERE cluster_id IS NOT NULL;
CREATE INDEX idx_discovered_faces_child ON discovered_faces(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX idx_discovered_faces_unnamed ON discovered_faces(session_id) WHERE is_named = FALSE AND is_skipped = FALSE;

-- RLS policies
ALTER TABLE discovered_faces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discovered faces"
ON discovered_faces FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'photographer')
  )
);

CREATE POLICY "Public can view discovered faces"
ON discovered_faces FOR SELECT
USING (true);
```

**Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/004_discovered_faces.sql
git commit -m "feat: add discovered_faces table with unique constraint and quality score"
```

---

## Task 2: TypeScript Types for Discovered Faces

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add DiscoveredFace type**

Add after `PhotoChild` interface (around line 62):

```typescript
export interface DiscoveredFace {
  id: string;
  session_id: string;
  photo_id: string;
  face_descriptor: number[];
  crop_url: string;
  detection_score: number;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  cluster_id: string | null;
  child_id: string | null;
  confidence: number | null;
  is_named: boolean;
  is_skipped: boolean;
  created_at: string;
}

export interface FaceCluster {
  cluster_id: string;
  faces: DiscoveredFace[];
  child_id: string | null;
  child_name: string | null;
  representative_crop_url: string;
  face_count: number;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add DiscoveredFace and FaceCluster types"
```

---

## Task 3: Face Crop Utility Functions

**Files:**
- Create: `src/lib/face-recognition/cropper.ts`

**Step 1: Create the face cropper utility**

```typescript
"use client";

import * as faceapi from "face-api.js";

export interface FaceCrop {
  dataUrl: string;
  blob: Blob;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  detectionScore: number;
}

/**
 * Extract a face crop from an image using the detection bounding box
 * Adds padding around the face for better context
 */
export function extractFaceCrop(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  detection: faceapi.FaceDetection,
  padding: number = 0.4
): FaceCrop {
  const box = detection.box;

  // Add padding
  const paddingX = box.width * padding;
  const paddingY = box.height * padding;

  const x = Math.max(0, box.x - paddingX);
  const y = Math.max(0, box.y - paddingY);
  const width = Math.min(imageElement.width - x, box.width + paddingX * 2);
  const height = Math.min(imageElement.height - y, box.height + paddingY * 2);

  // Create canvas for cropping
  const canvas = document.createElement("canvas");
  const size = 200; // Standard size for face crops
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    imageElement,
    x, y, width, height,
    0, 0, size, size
  );

  // Get data URL
  const dataUrl = canvas.toDataURL("image/webp", 0.8);

  // Convert to blob
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([array], { type: "image/webp" });

  return {
    dataUrl,
    blob,
    bbox: { x, y, width, height },
    detectionScore: detection.score,
  };
}

/**
 * Extract all face crops from an image
 * Filters out low-quality detections (score < 0.8)
 */
export function extractAllFaceCrops(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  detections: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>>[],
  minScore: number = 0.8
): Array<FaceCrop & { descriptor: Float32Array }> {
  // Filter by quality score
  const goodDetections = detections.filter(d => d.detection.score >= minScore);

  return goodDetections.map((detection) => ({
    ...extractFaceCrop(imageElement, detection.detection),
    descriptor: detection.descriptor,
  }));
}
```

**Step 2: Export from index**

Add to `src/lib/face-recognition/index.ts`:

```typescript
export { extractFaceCrop, extractAllFaceCrops } from "./cropper";
export type { FaceCrop } from "./cropper";
```

**Step 3: Commit**

```bash
git add src/lib/face-recognition/cropper.ts src/lib/face-recognition/index.ts
git commit -m "feat: add face cropping utility with quality filtering"
```

---

## Task 4: Memory-Efficient Face Discovery Processor

**Files:**
- Create: `src/lib/face-recognition/discovery.ts`

**Step 1: Create the discovery processor with batch processing**

```typescript
"use client";

import { detectFaces, loadImage, loadModels } from "./detector";
import { extractAllFaceCrops, type FaceCrop } from "./cropper";
import { descriptorToArray } from "./processor";

export interface DiscoveredFaceData {
  photoId: string;
  descriptor: number[];
  cropBlob: Blob;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  detectionScore: number;
}

export interface DiscoveryProgress {
  current: number;
  total: number;
  photoId: string;
  facesFound: number;
  totalFacesSoFar: number;
  status: "loading" | "detecting" | "cropping" | "saving" | "complete" | "error";
}

const BATCH_SIZE = 10; // Process 10 photos at a time to prevent memory issues
const MIN_DETECTION_SCORE = 0.8; // Only accept high-quality detections

/**
 * Discover all faces in a batch of photos
 * Memory-efficient: processes in batches and releases memory between batches
 */
export async function discoverFacesInBatch(
  photos: Array<{ id: string; url: string }>,
  onProgress?: (progress: DiscoveryProgress) => void,
  onBatchComplete?: (faces: DiscoveredFaceData[]) => Promise<void>
): Promise<DiscoveredFaceData[]> {
  await loadModels();

  const allFaces: DiscoveredFaceData[] = [];
  const total = photos.length;
  let totalFacesSoFar = 0;

  // Process in batches to prevent memory leaks
  for (let batchStart = 0; batchStart < photos.length; batchStart += BATCH_SIZE) {
    const batch = photos.slice(batchStart, batchStart + BATCH_SIZE);
    const batchFaces: DiscoveredFaceData[] = [];

    // Process each photo in the batch
    for (let i = 0; i < batch.length; i++) {
      const photo = batch[i];
      const globalIndex = batchStart + i;

      try {
        // Loading
        onProgress?.({
          current: globalIndex + 1,
          total,
          photoId: photo.id,
          facesFound: 0,
          totalFacesSoFar,
          status: "loading",
        });

        const img = await loadImage(photo.url);

        // Detecting
        onProgress?.({
          current: globalIndex + 1,
          total,
          photoId: photo.id,
          facesFound: 0,
          totalFacesSoFar,
          status: "detecting",
        });

        const detections = await detectFaces(img);

        // Cropping (with quality filter)
        onProgress?.({
          current: globalIndex + 1,
          total,
          photoId: photo.id,
          facesFound: detections.length,
          totalFacesSoFar,
          status: "cropping",
        });

        const crops = extractAllFaceCrops(img, detections, MIN_DETECTION_SCORE);

        // Convert to storage format
        for (const crop of crops) {
          const faceData: DiscoveredFaceData = {
            photoId: photo.id,
            descriptor: descriptorToArray(crop.descriptor),
            cropBlob: crop.blob,
            bbox: crop.bbox,
            detectionScore: crop.detectionScore,
          };
          batchFaces.push(faceData);
          allFaces.push(faceData);
        }

        totalFacesSoFar += crops.length;

        // Complete for this photo
        onProgress?.({
          current: globalIndex + 1,
          total,
          photoId: photo.id,
          facesFound: crops.length,
          totalFacesSoFar,
          status: "complete",
        });

      } catch (error) {
        console.error(`Error discovering faces in photo ${photo.id}:`, error);
        onProgress?.({
          current: globalIndex + 1,
          total,
          photoId: photo.id,
          facesFound: 0,
          totalFacesSoFar,
          status: "error",
        });
      }
    }

    // Save batch incrementally (progress persistence)
    if (batchFaces.length > 0 && onBatchComplete) {
      onProgress?.({
        current: Math.min(batchStart + BATCH_SIZE, total),
        total,
        photoId: batch[batch.length - 1].id,
        facesFound: batchFaces.length,
        totalFacesSoFar,
        status: "saving",
      });
      await onBatchComplete(batchFaces);
    }

    // Small delay to let garbage collector breathe
    await new Promise((r) => setTimeout(r, 50));
  }

  return allFaces;
}
```

**Step 2: Export from index**

Add to `src/lib/face-recognition/index.ts`:

```typescript
export { discoverFacesInBatch } from "./discovery";
export type { DiscoveredFaceData, DiscoveryProgress } from "./discovery";
```

**Step 3: Commit**

```bash
git add src/lib/face-recognition/discovery.ts src/lib/face-recognition/index.ts
git commit -m "feat: add memory-efficient face discovery with batch processing"
```

---

## Task 5: Optimized Face Clustering Algorithm (Union-Find)

**Files:**
- Create: `src/lib/face-recognition/clustering.ts`

**Step 1: Create the clustering algorithm with Union-Find**

```typescript
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
```

**Step 2: Export from index**

Add to `src/lib/face-recognition/index.ts`:

```typescript
export { clusterFaces, findMatchingChild } from "./clustering";
export type { ClusterableItem, Cluster } from "./clustering";
```

**Step 3: Commit**

```bash
git add src/lib/face-recognition/clustering.ts src/lib/face-recognition/index.ts
git commit -m "feat: add optimized Union-Find face clustering algorithm"
```

---

## Task 6: Server Actions for Face Discovery (with photo_children!)

**Files:**
- Modify: `src/lib/actions/faces.ts`

**Step 1: Add face discovery server actions**

Add after existing functions (around line 227):

```typescript
/**
 * Save discovered faces to database
 * Uses upsert to prevent duplicates on re-run
 * Returns face IDs for clustering
 */
export async function saveDiscoveredFaces(
  sessionId: string,
  faces: Array<{
    photoId: string;
    descriptor: number[];
    cropUrl: string;
    bbox: { x: number; y: number; width: number; height: number };
    detectionScore: number;
  }>
): Promise<string[]> {
  const supabase = await createClient();

  const insertData = faces.map(face => ({
    session_id: sessionId,
    photo_id: face.photoId,
    face_descriptor: face.descriptor,
    crop_url: face.cropUrl,
    detection_score: face.detectionScore,
    bbox_x: face.bbox.x,
    bbox_y: face.bbox.y,
    bbox_width: face.bbox.width,
    bbox_height: face.bbox.height,
    is_named: false,
    is_skipped: false,
  }));

  // Use upsert to handle re-runs (same bbox = same face)
  const { data, error } = await supabase
    .from("discovered_faces")
    .upsert(insertData, {
      onConflict: "photo_id,bbox_x,bbox_y,bbox_width,bbox_height",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    console.error("Error saving discovered faces:", error);
    throw new Error("Failed to save discovered faces");
  }

  revalidatePath("/admin/faces");

  return data?.map(d => d.id) || [];
}

/**
 * Get all discovered faces for a session
 */
export async function getDiscoveredFaces(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discovered_faces")
    .select(`
      id,
      photo_id,
      face_descriptor,
      crop_url,
      detection_score,
      bbox_x,
      bbox_y,
      bbox_width,
      bbox_height,
      cluster_id,
      child_id,
      confidence,
      is_named,
      is_skipped,
      children (id, first_name)
    `)
    .eq("session_id", sessionId)
    .order("created_at");

  if (error) {
    console.error("Error fetching discovered faces:", error);
    return [];
  }

  return data || [];
}

/**
 * Get unnamed faces for a session (for the naming UI)
 */
export async function getUnnamedFaces(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discovered_faces")
    .select(`
      id,
      photo_id,
      crop_url,
      cluster_id,
      detection_score
    `)
    .eq("session_id", sessionId)
    .eq("is_named", false)
    .eq("is_skipped", false)
    .order("cluster_id");

  if (error) {
    console.error("Error fetching unnamed faces:", error);
    return [];
  }

  return data || [];
}

/**
 * Update cluster assignments for faces
 */
export async function updateFaceClusters(
  assignments: Array<{ faceId: string; clusterId: string }>
) {
  const supabase = await createClient();

  // Batch update using Promise.all
  await Promise.all(
    assignments.map(({ faceId, clusterId }) =>
      supabase
        .from("discovered_faces")
        .update({ cluster_id: clusterId })
        .eq("id", faceId)
    )
  );

  revalidatePath("/admin/faces");
}

/**
 * Name a cluster (assign all faces in cluster to a child)
 * CRITICAL: Also creates photo_children records for parent gallery!
 */
export async function nameCluster(
  clusterId: string,
  childId: string,
  sessionId: string
) {
  const supabase = await createClient();

  // 1. Get all faces in this cluster
  const { data: faces, error: fetchError } = await supabase
    .from("discovered_faces")
    .select("id, photo_id, face_descriptor")
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId);

  if (fetchError || !faces) {
    console.error("Error fetching cluster faces:", fetchError);
    throw new Error("Failed to fetch cluster faces");
  }

  // 2. Update discovered_faces
  const { error: updateError } = await supabase
    .from("discovered_faces")
    .update({
      child_id: childId,
      is_named: true,
      confidence: 1.0, // Manual assignment = 100% confidence
    })
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId);

  if (updateError) {
    console.error("Error naming cluster:", updateError);
    throw new Error("Failed to name cluster");
  }

  // 3. CRITICAL: Create photo_children records for parent gallery!
  const photoIds = [...new Set(faces.map(f => f.photo_id))];

  const photoChildrenData = photoIds.map(photoId => ({
    photo_id: photoId,
    child_id: childId,
    confidence: 1.0,
    is_confirmed: true, // Manual assignment = confirmed
  }));

  // Upsert to handle duplicates (child might already be in photo from another face)
  const { error: pcError } = await supabase
    .from("photo_children")
    .upsert(photoChildrenData, {
      onConflict: "photo_id,child_id",
      ignoreDuplicates: true,
    });

  if (pcError) {
    console.error("Error creating photo_children:", pcError);
    throw new Error("Failed to link photos to child");
  }

  revalidatePath("/admin/faces");
  revalidatePath("/admin/sessions");
  revalidatePath("/gallery"); // Parent gallery needs refresh!
}

/**
 * Skip a face (mark as "not a face" or irrelevant)
 */
export async function skipFace(faceId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("discovered_faces")
    .update({ is_skipped: true, is_named: true })
    .eq("id", faceId);

  if (error) {
    console.error("Error skipping face:", error);
    throw new Error("Failed to skip face");
  }

  revalidatePath("/admin/faces");
}

/**
 * Skip all faces in a cluster
 */
export async function skipCluster(clusterId: string, sessionId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("discovered_faces")
    .update({ is_skipped: true, is_named: true })
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId);

  if (error) {
    console.error("Error skipping cluster:", error);
    throw new Error("Failed to skip cluster");
  }

  revalidatePath("/admin/faces");
}

/**
 * Undo last naming action (revert a cluster back to unnamed)
 */
export async function undoClusterNaming(clusterId: string, sessionId: string) {
  const supabase = await createClient();

  // 1. Get the child_id before we clear it
  const { data: faces } = await supabase
    .from("discovered_faces")
    .select("child_id, photo_id")
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId)
    .limit(1);

  const childId = faces?.[0]?.child_id;

  // 2. Revert discovered_faces
  const { error } = await supabase
    .from("discovered_faces")
    .update({
      child_id: null,
      is_named: false,
      is_skipped: false,
      confidence: null,
    })
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId);

  if (error) {
    console.error("Error undoing cluster naming:", error);
    throw new Error("Failed to undo naming");
  }

  // 3. Remove photo_children records (only if no other faces link them)
  if (childId) {
    const photoIds = faces?.map(f => f.photo_id) || [];
    for (const photoId of photoIds) {
      // Check if there are other named faces linking this photo to this child
      const { count } = await supabase
        .from("discovered_faces")
        .select("*", { count: "exact", head: true })
        .eq("photo_id", photoId)
        .eq("child_id", childId)
        .eq("is_named", true);

      if (count === 0) {
        await supabase
          .from("photo_children")
          .delete()
          .eq("photo_id", photoId)
          .eq("child_id", childId);
      }
    }
  }

  revalidatePath("/admin/faces");
  revalidatePath("/gallery");
}

/**
 * Create a new child and assign to cluster
 * (Auto-create family per child approach)
 */
export async function createChildFromCluster(
  clusterId: string,
  sessionId: string,
  firstName: string,
  locationId: string
) {
  const supabase = await createClient();

  // Generate access code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let accessCode = "TEDDY";
  for (let i = 0; i < 3; i++) {
    accessCode += chars[Math.floor(Math.random() * chars.length)];
  }

  // Create family for this child
  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({
      family_name: firstName,
      location_id: locationId,
      access_code: accessCode,
    })
    .select()
    .single();

  if (familyError) {
    console.error("Error creating family:", familyError);
    throw new Error("Failed to create family");
  }

  // Get representative face descriptor for enrollment
  const { data: face } = await supabase
    .from("discovered_faces")
    .select("face_descriptor, crop_url")
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId)
    .limit(1)
    .single();

  // Create child with face descriptor (auto-enrolled!)
  const { data: child, error: childError } = await supabase
    .from("children")
    .insert({
      family_id: family.id,
      first_name: firstName,
      face_descriptor: face?.face_descriptor,
      reference_photo_url: face?.crop_url,
      is_enrolled: true,
    })
    .select()
    .single();

  if (childError) {
    console.error("Error creating child:", childError);
    throw new Error("Failed to create child");
  }

  // Now name the cluster with this new child
  await nameCluster(clusterId, child.id, sessionId);

  revalidatePath("/admin/families");

  return { family, child };
}

/**
 * Get all existing children for naming (grouped by location)
 */
export async function getChildrenForNaming(locationId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("children")
    .select(`
      id,
      first_name,
      families (
        id,
        family_name,
        location_id
      )
    `)
    .order("first_name");

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching children:", error);
    return [];
  }

  // Filter by location if provided
  if (locationId) {
    return (data || []).filter((c: any) => c.families?.location_id === locationId);
  }

  return data || [];
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/faces.ts
git commit -m "feat: add server actions with photo_children creation, skip, and undo"
```

---

## Task 7: Face Crop Upload Action

**Files:**
- Modify: `src/lib/actions/upload.ts`

**Step 1: Add face crop upload function**

Add to existing upload.ts:

```typescript
/**
 * Upload a face crop to Supabase storage
 */
export async function uploadFaceCrop(
  sessionId: string,
  faceId: string,
  blob: Blob
): Promise<string> {
  const supabase = await createClient();

  const filename = `faces/${sessionId}/${faceId}.webp`;

  const { error } = await supabase.storage
    .from("photos")
    .upload(filename, blob, {
      contentType: "image/webp",
      upsert: true,
    });

  if (error) {
    console.error("Error uploading face crop:", error);
    throw new Error("Failed to upload face crop");
  }

  const { data: publicUrl } = supabase.storage
    .from("photos")
    .getPublicUrl(filename);

  return publicUrl.publicUrl;
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/upload.ts
git commit -m "feat: add face crop upload action"
```

---

## Task 8: Face Discovery Component (with incremental saving)

**Files:**
- Create: `src/components/faces/face-discovery.tsx`

**Step 1: Create the face discovery component**

```typescript
"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Scan,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Save,
} from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import {
  discoverFacesInBatch,
  clusterFaces,
  type DiscoveryProgress,
  type DiscoveredFaceData,
} from "@/lib/face-recognition";
import { uploadFaceCrop } from "@/lib/actions/upload";
import { saveDiscoveredFaces, updateFaceClusters } from "@/lib/actions/faces";

interface FaceDiscoveryProps {
  sessionId: string;
  photos: Array<{ id: string; url: string }>;
  onComplete: (totalFaces: number) => void;
}

export function FaceDiscovery({
  sessionId,
  photos,
  onComplete,
}: FaceDiscoveryProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [totalFacesFound, setTotalFacesFound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [phase, setPhase] = useState<"detecting" | "clustering" | "done">("detecting");

  const handleProgress = useCallback((p: DiscoveryProgress) => {
    setProgress(p);
    setTotalFacesFound(p.totalFacesSoFar);
  }, []);

  // Handle batch completion (incremental saving)
  const handleBatchComplete = useCallback(async (batchFaces: DiscoveredFaceData[]) => {
    // Upload face crops
    const facesToSave: Array<{
      photoId: string;
      descriptor: number[];
      cropUrl: string;
      bbox: { x: number; y: number; width: number; height: number };
      detectionScore: number;
    }> = [];

    for (const face of batchFaces) {
      const faceId = crypto.randomUUID();
      const cropUrl = await uploadFaceCrop(sessionId, faceId, face.cropBlob);

      facesToSave.push({
        photoId: face.photoId,
        descriptor: face.descriptor,
        cropUrl,
        bbox: face.bbox,
        detectionScore: face.detectionScore,
      });
    }

    // Save to database incrementally
    await saveDiscoveredFaces(sessionId, facesToSave);
  }, [sessionId]);

  const startDiscovery = async () => {
    if (photos.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setTotalFacesFound(0);
    setIsComplete(false);
    setPhase("detecting");

    try {
      // Phase 1: Discover all faces with incremental saving
      const discoveredFaces = await discoverFacesInBatch(
        photos,
        handleProgress,
        handleBatchComplete
      );

      // Phase 2: Cluster similar faces
      setPhase("clustering");

      // Get saved face IDs from database
      const { data: savedFaces } = await fetch(`/api/faces?session=${sessionId}`).then(r => r.json());

      if (savedFaces && savedFaces.length > 0) {
        const clusterableItems = savedFaces.map((f: any) => ({
          id: f.id,
          descriptor: f.face_descriptor,
        }));

        const clusters = clusterFaces(clusterableItems);

        // Update cluster assignments
        const assignments = clusters.flatMap((cluster) =>
          cluster.items.map((faceId) => ({
            faceId,
            clusterId: cluster.id,
          }))
        );

        await updateFaceClusters(assignments);
      }

      setPhase("done");
      setIsComplete(true);
      onComplete(discoveredFaces.length);
    } catch (err) {
      console.error("Discovery failed:", err);
      setError("Face discovery failed. Please try again.");
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <Card variant="glass">
      <CardContent className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-400/10 flex items-center justify-center">
              <Scan className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">
                Face Discovery
              </h3>
              <p className="text-sm text-charcoal-400">
                Detect and extract all faces from {photos.length} photos
              </p>
            </div>
          </div>

          {!isProcessing && !isComplete && (
            <Button
              onClick={startDiscovery}
              disabled={photos.length === 0}
              variant="secondary"
            >
              <Brain className="w-4 h-4 mr-2" />
              Start Discovery
            </Button>
          )}
        </div>

        {/* Progress */}
        <AnimatePresence>
          {isProcessing && progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-charcoal-400">
                  {phase === "detecting"
                    ? `Processing photo ${progress.current} of ${progress.total}`
                    : "Clustering similar faces..."}
                </span>
                <span className="text-white">{progressPercent}%</span>
              </div>

              <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-charcoal-400">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                {progress.status === "loading" && "Loading image..."}
                {progress.status === "detecting" && "Detecting faces..."}
                {progress.status === "cropping" && `Found ${progress.facesFound} face(s), extracting...`}
                {progress.status === "saving" && (
                  <>
                    <Save className="w-4 h-4 text-teal-400" />
                    Saving batch...
                  </>
                )}
              </div>

              <div className="text-sm text-purple-300">
                {totalFacesFound} faces discovered (saved incrementally)
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Complete */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3">
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Discovery Complete
                </Badge>
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-lg font-serif text-white mb-1">
                  {totalFacesFound} faces discovered & clustered
                </p>
                <p className="text-sm text-purple-300">
                  Go to the Faces page to name and organize them
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create index file**

Create `src/components/faces/index.ts`:

```typescript
export { FaceDiscovery } from "./face-discovery";
```

**Step 3: Commit**

```bash
git add src/components/faces/face-discovery.tsx src/components/faces/index.ts
git commit -m "feat: add face discovery component with incremental saving"
```

---

## Task 9: Face Naming Component (with Skip, Undo, Keyboard Shortcuts)

**Files:**
- Create: `src/components/faces/face-naming.tsx`

**Step 1: Create the bulk naming component**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  UserPlus,
  Check,
  Save,
  Loader2,
  Users,
  X,
  Undo,
  Keyboard,
} from "lucide-react";
import { Button, Card, CardContent, Badge, Input } from "@/components/ui";
import {
  getUnnamedFaces,
  getChildrenForNaming,
  nameCluster,
  createChildFromCluster,
  skipCluster,
  undoClusterNaming,
} from "@/lib/actions/faces";
import { cn } from "@/lib/utils";

interface FaceNamingProps {
  sessionId: string;
  locationId: string;
  onComplete: () => void;
}

interface FaceGroup {
  clusterId: string;
  faces: Array<{ id: string; cropUrl: string }>;
  selectedChildId: string | null;
  newChildName: string;
  isCreatingNew: boolean;
  isSkipped: boolean;
}

interface LastAction {
  type: "name" | "skip" | "create";
  clusterId: string;
  previousState: FaceGroup;
}

export function FaceNaming({
  sessionId,
  locationId,
  onComplete,
}: FaceNamingProps) {
  const [faceGroups, setFaceGroups] = useState<FaceGroup[]>([]);
  const [existingChildren, setExistingChildren] = useState<
    Array<{ id: string; firstName: string; familyName: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  useEffect(() => {
    loadData();
  }, [sessionId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // Ignore when typing

      const activeGroup = faceGroups[activeGroupIndex];
      if (!activeGroup) return;

      // Number keys 1-9 for quick name selection
      if (e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        if (existingChildren[index]) {
          handleSelectChild(activeGroup.clusterId, existingChildren[index].id);
          // Auto-advance to next group
          if (activeGroupIndex < faceGroups.length - 1) {
            setActiveGroupIndex(activeGroupIndex + 1);
          }
        }
      }

      // Arrow keys to navigate groups
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveGroupIndex(Math.min(activeGroupIndex + 1, faceGroups.length - 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveGroupIndex(Math.max(activeGroupIndex - 1, 0));
      }

      // S to skip current group
      if (e.key === "s" || e.key === "S") {
        handleSkipCluster(activeGroup.clusterId);
        if (activeGroupIndex < faceGroups.length - 1) {
          setActiveGroupIndex(activeGroupIndex + 1);
        }
      }

      // Z to undo
      if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleUndo();
      }

      // N for new child
      if (e.key === "n" || e.key === "N") {
        handleToggleNewChild(activeGroup.clusterId);
      }

      // ? for help
      if (e.key === "?") {
        setShowKeyboardHelp(!showKeyboardHelp);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [faceGroups, activeGroupIndex, existingChildren, showKeyboardHelp]);

  async function loadData() {
    setLoading(true);

    const [faces, children] = await Promise.all([
      getUnnamedFaces(sessionId),
      getChildrenForNaming(locationId),
    ]);

    // Group faces by cluster
    const groupedByCluster = new Map<string, Array<{ id: string; cropUrl: string }>>();

    for (const face of faces) {
      const clusterId = face.cluster_id || face.id;
      const existing = groupedByCluster.get(clusterId) || [];
      existing.push({ id: face.id, cropUrl: face.crop_url });
      groupedByCluster.set(clusterId, existing);
    }

    const groups: FaceGroup[] = Array.from(groupedByCluster.entries()).map(
      ([clusterId, faces]) => ({
        clusterId,
        faces,
        selectedChildId: null,
        newChildName: "",
        isCreatingNew: false,
        isSkipped: false,
      })
    );

    setFaceGroups(groups);
    setExistingChildren(
      children.map((c: any) => ({
        id: c.id,
        firstName: c.first_name,
        familyName: c.families?.family_name || "",
      }))
    );
    setLoading(false);
  }

  const handleSelectChild = (clusterId: string, childId: string) => {
    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === clusterId
          ? { ...g, selectedChildId: childId, isCreatingNew: false, newChildName: "", isSkipped: false }
          : g
      )
    );
  };

  const handleToggleNewChild = (clusterId: string) => {
    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === clusterId
          ? { ...g, isCreatingNew: !g.isCreatingNew, selectedChildId: null, isSkipped: false }
          : g
      )
    );
  };

  const handleNewChildName = (clusterId: string, name: string) => {
    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === clusterId ? { ...g, newChildName: name } : g
      )
    );
  };

  const handleSkipCluster = (clusterId: string) => {
    const group = faceGroups.find(g => g.clusterId === clusterId);
    if (group) {
      setLastAction({ type: "skip", clusterId, previousState: { ...group } });
    }

    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === clusterId
          ? { ...g, isSkipped: true, selectedChildId: null, isCreatingNew: false, newChildName: "" }
          : g
      )
    );
  };

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;

    // Restore previous state
    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === lastAction.clusterId ? lastAction.previousState : g
      )
    );

    // If it was a save action, also undo in database
    if (lastAction.type === "name" || lastAction.type === "create") {
      try {
        await undoClusterNaming(lastAction.clusterId, sessionId);
      } catch (error) {
        console.error("Error undoing:", error);
      }
    }

    setLastAction(null);
  }, [lastAction, sessionId]);

  const handleSaveAll = async () => {
    setSaving(true);

    try {
      for (const group of faceGroups) {
        if (group.isSkipped) {
          await skipCluster(group.clusterId, sessionId);
        } else if (group.selectedChildId) {
          setLastAction({ type: "name", clusterId: group.clusterId, previousState: { ...group } });
          await nameCluster(group.clusterId, group.selectedChildId, sessionId);
        } else if (group.isCreatingNew && group.newChildName.trim()) {
          setLastAction({ type: "create", clusterId: group.clusterId, previousState: { ...group } });
          await createChildFromCluster(
            group.clusterId,
            sessionId,
            group.newChildName.trim(),
            locationId
          );
        }
      }

      onComplete();
    } catch (error) {
      console.error("Error saving names:", error);
    } finally {
      setSaving(false);
    }
  };

  const namedCount = faceGroups.filter(
    (g) => g.selectedChildId || (g.isCreatingNew && g.newChildName.trim()) || g.isSkipped
  ).length;

  if (loading) {
    return (
      <Card variant="glass" className="p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-gold-500" />
          <span className="text-charcoal-400">Loading faces...</span>
        </div>
      </Card>
    );
  }

  if (faceGroups.length === 0) {
    return (
      <Card variant="glass" className="p-8 text-center">
        <Users className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
        <p className="text-charcoal-400">No unnamed faces to review</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif text-white">Name Faces</h2>
          <p className="text-sm text-charcoal-400">
            {faceGroups.length} face groups • {namedCount} processed
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
            >
              <Undo className="w-4 h-4 mr-2" />
              Undo
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
          >
            <Keyboard className="w-4 h-4 mr-2" />
            Shortcuts
          </Button>

          <Button
            variant="primary"
            onClick={handleSaveAll}
            disabled={saving || namedCount === 0}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save All ({namedCount})
          </Button>
        </div>
      </div>

      {/* Keyboard Help */}
      <AnimatePresence>
        {showKeyboardHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card variant="glass" className="p-4">
              <h4 className="text-sm font-medium text-white mb-2">Keyboard Shortcuts</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><kbd className="bg-charcoal-700 px-1 rounded">1-9</kbd> Quick assign name</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">←→</kbd> Navigate groups</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">S</kbd> Skip group</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">N</kbd> New child</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">⌘Z</kbd> Undo</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">?</kbd> Toggle help</div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Face Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {faceGroups.map((group, index) => (
          <motion.div
            key={group.clusterId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              variant={group.selectedChildId || group.newChildName || group.isSkipped ? "glass" : "default"}
              className={cn(
                "p-4 transition-all cursor-pointer",
                index === activeGroupIndex && "ring-2 ring-gold-500",
                group.selectedChildId && "border-teal-500/50",
                group.isSkipped && "border-charcoal-600 opacity-50"
              )}
              onClick={() => setActiveGroupIndex(index)}
            >
              {/* Face thumbnails */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {group.faces.slice(0, 5).map((face) => (
                  <img
                    key={face.id}
                    src={face.cropUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                ))}
                {group.faces.length > 5 && (
                  <div className="w-16 h-16 rounded-lg bg-charcoal-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm text-charcoal-400">
                      +{group.faces.length - 5}
                    </span>
                  </div>
                )}
              </div>

              {/* Status indicators */}
              {group.isSkipped && (
                <Badge variant="default" className="mb-3">
                  <X className="w-3 h-3 mr-1" />
                  Skipped
                </Badge>
              )}
              {group.selectedChildId && (
                <Badge variant="success" className="mb-3">
                  <Check className="w-3 h-3 mr-1" />
                  {existingChildren.find((c) => c.id === group.selectedChildId)?.firstName}
                </Badge>
              )}
              {group.newChildName && (
                <Badge variant="success" className="mb-3">
                  <UserPlus className="w-3 h-3 mr-1" />
                  {group.newChildName} (new)
                </Badge>
              )}

              {/* Name buttons */}
              {!group.isSkipped && (
                <div className="space-y-2">
                  {/* Existing children as pressable buttons */}
                  <div className="flex flex-wrap gap-2">
                    {existingChildren.slice(0, 9).map((child, childIndex) => (
                      <button
                        key={child.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectChild(group.clusterId, child.id);
                        }}
                        className={cn(
                          "px-3 py-1.5 text-sm rounded-full transition-all",
                          group.selectedChildId === child.id
                            ? "bg-teal-500 text-white"
                            : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                        )}
                      >
                        <span className="text-xs text-charcoal-500 mr-1">{childIndex + 1}</span>
                        {child.firstName}
                      </button>
                    ))}
                  </div>

                  {/* Actions row */}
                  <div className="flex gap-2 pt-2 border-t border-charcoal-700">
                    {group.isCreatingNew ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          placeholder="Enter name..."
                          value={group.newChildName}
                          onChange={(e) =>
                            handleNewChildName(group.clusterId, e.target.value)
                          }
                          className="flex-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleNewChild(group.clusterId);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleNewChild(group.clusterId);
                          }}
                          className="flex-1"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          New
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSkipCluster(group.clusterId);
                          }}
                          className="text-charcoal-400"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Skip
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Export from index**

Add to `src/components/faces/index.ts`:

```typescript
export { FaceNaming } from "./face-naming";
```

**Step 3: Commit**

```bash
git add src/components/faces/face-naming.tsx src/components/faces/index.ts
git commit -m "feat: add face naming component with skip, undo, and keyboard shortcuts"
```

---

## Task 10: API Route for Getting Discovered Faces

**Files:**
- Create: `src/app/api/faces/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("session");

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discovered_faces")
    .select("id, face_descriptor")
    .eq("session_id", sessionId)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
```

**Step 2: Commit**

```bash
git add src/app/api/faces/route.ts
git commit -m "feat: add API route for getting discovered faces"
```

---

## Task 11: Faces Admin Page

**Files:**
- Create: `src/app/(dashboard)/admin/faces/page.tsx`

**Step 1: Create the faces management page**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  Scan,
  ArrowLeft,
  Loader2,
  Check,
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { FaceNaming } from "@/components/faces";
import { createClient } from "@/lib/supabase/client";

interface Session {
  id: string;
  name: string;
  shoot_date: string;
  location_id: string;
  total_photos: number;
  location: { name: string }[];
}

export default function FacesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [faceStats, setFaceStats] = useState<Record<string, { total: number; unnamed: number }>>({});

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (sessionId && sessions.length > 0) {
      const session = sessions.find((s) => s.id === sessionId);
      setSelectedSession(session || null);
    }
  }, [sessionId, sessions]);

  async function fetchSessions() {
    const supabase = createClient();

    const { data: sessionsData } = await supabase
      .from("photo_sessions")
      .select(`
        id,
        name,
        shoot_date,
        location_id,
        total_photos,
        location:locations (name)
      `)
      .order("shoot_date", { ascending: false });

    setSessions(sessionsData || []);

    // Get face stats for each session
    const stats: Record<string, { total: number; unnamed: number }> = {};

    for (const session of sessionsData || []) {
      const { count: total } = await supabase
        .from("discovered_faces")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id);

      const { count: unnamed } = await supabase
        .from("discovered_faces")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("is_named", false)
        .eq("is_skipped", false);

      stats[session.id] = {
        total: total || 0,
        unnamed: unnamed || 0,
      };
    }

    setFaceStats(stats);
    setLoading(false);
  }

  const handleComplete = () => {
    fetchSessions();
    router.push("/admin/faces");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar role="admin" />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />

      <main className="flex-1 ml-64">
        <Header
          title="Face Management"
          subtitle="Discover and name faces in your photos"
        />

        <div className="p-6">
          {selectedSession ? (
            <>
              {/* Back button */}
              <Link
                href="/admin/faces"
                className="flex items-center gap-2 text-charcoal-400 hover:text-white transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sessions
              </Link>

              {/* Session info */}
              <Card variant="glass" className="p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">
                      {selectedSession.name}
                    </h2>
                    <p className="text-sm text-charcoal-400">
                      {selectedSession.location?.[0]?.name} •{" "}
                      {formatDate(selectedSession.shoot_date)}
                    </p>
                  </div>
                  <Badge variant="default">
                    {faceStats[selectedSession.id]?.unnamed || 0} faces to name
                  </Badge>
                </div>
              </Card>

              {/* Face Naming UI */}
              <FaceNaming
                sessionId={selectedSession.id}
                locationId={selectedSession.location_id}
                onComplete={handleComplete}
              />
            </>
          ) : (
            <>
              {/* Session list */}
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <Card variant="glass" className="p-12 text-center">
                    <Scan className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
                    <p className="text-charcoal-400">No sessions with photos yet</p>
                  </Card>
                ) : (
                  sessions.map((session, index) => {
                    const stats = faceStats[session.id] || { total: 0, unnamed: 0 };

                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card
                          variant="default"
                          className="p-4 hover:bg-charcoal-800/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/admin/faces?session=${session.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-white">
                                {session.name}
                              </p>
                              <p className="text-sm text-charcoal-400">
                                {session.location?.[0]?.name} •{" "}
                                {formatDate(session.shoot_date)} •{" "}
                                {session.total_photos} photos
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {stats.total === 0 ? (
                                <Badge variant="default">
                                  <Scan className="w-3 h-3 mr-1" />
                                  No faces yet
                                </Badge>
                              ) : stats.unnamed === 0 ? (
                                <Badge variant="success">
                                  <Check className="w-3 h-3 mr-1" />
                                  All named
                                </Badge>
                              ) : (
                                <Badge variant="warning">
                                  <Users className="w-3 h-3 mr-1" />
                                  {stats.unnamed} to name
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/admin/faces/page.tsx
git commit -m "feat: add faces admin page for session-based face management"
```

---

## Task 12: Add Faces Link to Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Add Faces navigation item**

Find the admin navigation items and add Faces:

```typescript
// Add to imports
import { Scan } from "lucide-react";

// Add to adminLinks array (after Sessions or Families)
{ href: "/admin/faces", label: "Faces", icon: Scan },
```

**Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Faces link to admin sidebar"
```

---

## Task 13: Integrate Face Discovery into Session Page

**Files:**
- Modify: `src/app/(dashboard)/admin/sessions/[sessionId]/page.tsx`

**Step 1: Add Face Discovery button and component**

Add imports:

```typescript
import { FaceDiscovery } from "@/components/faces";
import { Scan } from "lucide-react";
```

Add state:

```typescript
const [showDiscovery, setShowDiscovery] = useState(false);
```

Add to the action buttons section (after "Add Photos" button):

```typescript
<Button
  variant="secondary"
  onClick={() => setShowDiscovery(!showDiscovery)}
>
  <Scan className="w-4 h-4 mr-2" />
  Discover Faces
</Button>
```

Add Face Discovery component below stats bar:

```typescript
{showDiscovery && (
  <div className="mb-6">
    <FaceDiscovery
      sessionId={sessionId}
      photos={photos.map((p) => ({
        id: p.id,
        url: p.original_url,
      }))}
      onComplete={(count) => {
        setShowDiscovery(false);
        // Optionally show success message or navigate
      }}
    />
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/admin/sessions/[sessionId]/page.tsx
git commit -m "feat: integrate face discovery into session detail page"
```

---

## Task 14: Final Testing and Polish

**Step 1: Test the complete flow**

Run: `npm run dev -- -p 8001`

1. Navigate to `/admin/sessions/[sessionId]`
2. Click "Discover Faces" button
3. Wait for discovery to complete (verify incremental saving)
4. Navigate to `/admin/faces?session=[sessionId]`
5. Test keyboard shortcuts (1-9, arrows, S, N, ⌘Z)
6. Name some faces using pressable buttons
7. Skip some faces using Skip button
8. Test Undo functionality
9. Create a new child from a face cluster
10. Click "Save All"
11. Verify photos are assigned to children (check `/gallery/[sessionId]/[familyCode]`)
12. Verify `photo_children` records are created

**Step 2: Fix any issues found during testing**

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: polish face discovery flow"
```

---

## Summary

This plan implements the complete Face Discovery Flow with all critical fixes:

| Feature | Status |
|---------|--------|
| Database schema with unique constraint | ✅ |
| Quality filtering (>0.8 detection score) | ✅ |
| Memory-efficient batch processing | ✅ |
| Incremental saving (progress persistence) | ✅ |
| Union-Find optimized clustering | ✅ |
| photo_children records on naming | ✅ |
| Skip faces ("Not a face") | ✅ |
| Undo last action | ✅ |
| Keyboard shortcuts | ✅ |
| Create new child from cluster | ✅ |
| Duplicate prevention (upsert) | ✅ |

**Task Order:**

```
Phase 1: Foundation
├── Task 1: Database Schema (with unique constraint)
├── Task 2: TypeScript Types
├── Task 3: Face Cropper (with quality filter)
└── Task 4: Memory-Efficient Discovery Processor

Phase 2: Core Logic
├── Task 5: Optimized Clustering (Union-Find)
├── Task 6: Server Actions (with photo_children!)
└── Task 7: Face Crop Upload

Phase 3: UI Components
├── Task 8: Face Discovery Component (incremental saving)
├── Task 9: Face Naming Component (skip, undo, keyboard)
├── Task 10: API Route for Faces
└── Task 11: Faces Admin Page

Phase 4: Integration
├── Task 12: Sidebar Link
├── Task 13: Session Integration
└── Task 14: Testing & Polish
```
