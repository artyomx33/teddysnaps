"use client";

import * as faceapi from "face-api.js";

let modelsLoaded = false;

/**
 * Load face-api.js models from public folder
 * Models should be placed in /public/models/
 */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  const MODEL_URL = "/models";

  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    console.log("✓ Face detection models loaded");
  } catch (error) {
    console.error("Failed to load face detection models:", error);
    throw new Error("Failed to load face detection models");
  }
}

/**
 * Check if models are loaded
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Detect faces in an image and extract descriptors
 */
export async function detectFaces(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>>[]> {
  if (!modelsLoaded) {
    await loadModels();
  }

  const detections = await faceapi
    .detectAllFaces(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections;
}

/**
 * Detect a single face (for enrollment photos)
 */
export async function detectSingleFace(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    await loadModels();
  }

  const detection = await faceapi
    .detectSingleFace(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection?.descriptor || null;
}

/**
 * Load an image from URL and return as HTMLImageElement
 */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
