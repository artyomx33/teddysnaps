"use client";

import * as faceapi from "face-api.js";

export interface EnrolledChild {
  id: string;
  firstName: string;
  descriptor: Float32Array;
}

export interface FaceMatch {
  childId: string;
  childName: string;
  confidence: number;
}

// Threshold for face matching (lower = more strict)
const MATCH_THRESHOLD = 0.6;

/**
 * Compare two face descriptors using Euclidean distance
 * Returns 0 for identical faces, higher values for different faces
 */
export function compareFaces(
  descriptor1: Float32Array,
  descriptor2: Float32Array
): number {
  return faceapi.euclideanDistance(descriptor1, descriptor2);
}

/**
 * Find the best matching child from enrolled faces
 */
export function findBestMatch(
  faceDescriptor: Float32Array,
  enrolledChildren: EnrolledChild[]
): FaceMatch | null {
  let bestMatch: FaceMatch | null = null;
  let bestDistance = Infinity;

  for (const child of enrolledChildren) {
    const distance = compareFaces(faceDescriptor, child.descriptor);

    if (distance < bestDistance && distance < MATCH_THRESHOLD) {
      bestDistance = distance;
      bestMatch = {
        childId: child.id,
        childName: child.firstName,
        confidence: Math.round((1 - distance) * 100) / 100, // Convert to 0-1 confidence
      };
    }
  }

  return bestMatch;
}

/**
 * Find all matching children in a photo with multiple faces
 */
export function findAllMatches(
  faceDescriptors: Float32Array[],
  enrolledChildren: EnrolledChild[]
): FaceMatch[] {
  const matches: FaceMatch[] = [];
  const matchedChildIds = new Set<string>();

  for (const descriptor of faceDescriptors) {
    const match = findBestMatch(descriptor, enrolledChildren);
    if (match && !matchedChildIds.has(match.childId)) {
      matches.push(match);
      matchedChildIds.add(match.childId);
    }
  }

  return matches;
}

/**
 * Create a FaceMatcher for faster repeated matching
 */
export function createFaceMatcher(
  enrolledChildren: EnrolledChild[]
): faceapi.FaceMatcher {
  const labeledDescriptors = enrolledChildren.map(
    (child) =>
      new faceapi.LabeledFaceDescriptors(child.id, [child.descriptor])
  );

  return new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
}
