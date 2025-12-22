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
