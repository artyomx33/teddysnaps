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
