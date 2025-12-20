"use client";

import { detectFaces, loadImage, loadModels } from "./detector";
import { findAllMatches, type EnrolledChild, type FaceMatch } from "./matcher";

export interface ProcessedPhoto {
  photoId: string;
  photoUrl: string;
  facesDetected: number;
  matches: FaceMatch[];
  needsReview: boolean;
  thumbnailUrl?: string;
}

export interface ProcessingProgress {
  current: number;
  total: number;
  photoId: string;
  status: "detecting" | "matching" | "complete" | "error";
}

/**
 * Process a batch of photos for face recognition
 */
export async function processPhotoBatch(
  photos: Array<{ id: string; url: string; thumbnailUrl?: string }>,
  enrolledChildren: EnrolledChild[],
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessedPhoto[]> {
  // Ensure models are loaded
  await loadModels();

  const results: ProcessedPhoto[] = [];
  const total = photos.length;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    try {
      // Report detecting status
      onProgress?.({
        current: i + 1,
        total,
        photoId: photo.id,
        status: "detecting",
      });

      // Load image
      const img = await loadImage(photo.url);

      // Detect all faces
      const detections = await detectFaces(img);

      // Report matching status
      onProgress?.({
        current: i + 1,
        total,
        photoId: photo.id,
        status: "matching",
      });

      // Extract descriptors and find matches
      const descriptors = detections.map((d) => d.descriptor);
      const matches = findAllMatches(descriptors, enrolledChildren);

      // Determine if manual review is needed
      // (faces detected but not matched)
      const needsReview = detections.length > matches.length;

      results.push({
        photoId: photo.id,
        photoUrl: photo.url,
        thumbnailUrl: photo.thumbnailUrl,
        facesDetected: detections.length,
        matches,
        needsReview,
      });

      // Report complete status
      onProgress?.({
        current: i + 1,
        total,
        photoId: photo.id,
        status: "complete",
      });
    } catch (error) {
      console.error(`Failed to process photo ${photo.id}:`, error);

      // Report error status
      onProgress?.({
        current: i + 1,
        total,
        photoId: photo.id,
        status: "error",
      });

      results.push({
        photoId: photo.id,
        photoUrl: photo.url,
        thumbnailUrl: photo.thumbnailUrl,
        facesDetected: 0,
        matches: [],
        needsReview: true,
      });
    }
  }

  return results;
}

/**
 * Enroll a child by extracting face descriptor from reference photo
 */
export async function enrollChild(
  imageUrl: string
): Promise<Float32Array | null> {
  await loadModels();

  try {
    const img = await loadImage(imageUrl);
    const detections = await detectFaces(img);

    if (detections.length === 0) {
      console.warn("No face detected in enrollment photo");
      return null;
    }

    if (detections.length > 1) {
      console.warn("Multiple faces detected, using the first one");
    }

    return detections[0].descriptor;
  } catch (error) {
    console.error("Failed to enroll child:", error);
    return null;
  }
}

/**
 * Convert Float32Array to JSON-serializable array
 */
export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

/**
 * Convert JSON array back to Float32Array
 */
export function arrayToDescriptor(array: number[]): Float32Array {
  return new Float32Array(array);
}
