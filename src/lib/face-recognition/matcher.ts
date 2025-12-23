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

export interface SuggestedMatch {
  childId: string;
  childName: string;
  familyName: string;
  similarity: number; // 0-1, higher is better
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return dot / denom; // [-1, 1]
}

/**
 * Find top N matching children for a face descriptor
 * Returns matches sorted by similarity (highest first)
 */
export function findTopMatches(
  faceDescriptor: number[],
  namedFaces: Array<{
    childId: string;
    childName: string;
    familyName: string;
    descriptor: number[];
  }>,
  maxResults: number = 3,
  minSimilarity: number = 0.65
): SuggestedMatch[] {
  const matches: SuggestedMatch[] = [];

  for (const named of namedFaces) {
    // InsightFace/ArcFace-style embeddings work best with cosine similarity.
    // Convert from [-1, 1] to [0, 1] for UI friendliness.
    const cos = cosineSimilarity(faceDescriptor, named.descriptor);
    const similarity = Math.max(0, Math.min(1, (cos + 1) / 2));

    if (similarity >= minSimilarity) {
      matches.push({
        childId: named.childId,
        childName: named.childName,
        familyName: named.familyName,
        similarity,
      });
    }
  }

  // Sort by similarity (highest first) and take top N
  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

/**
 * Run AI matching on all unnamed faces
 * Returns map of faceId -> suggested matches
 */
export function matchAllFaces(
  unnamedFaces: Array<{ id: string; descriptor: number[] }>,
  namedFaces: Array<{
    childId: string;
    childName: string;
    familyName: string;
    descriptor: number[];
  }>
): Map<string, SuggestedMatch[]> {
  const results = new Map<string, SuggestedMatch[]>();

  for (const face of unnamedFaces) {
    const matches = findTopMatches(face.descriptor, namedFaces);
    results.set(face.id, matches);
  }

  return results;
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
