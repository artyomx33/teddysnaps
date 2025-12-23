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
 * Find top N matching children for an embedding vector.
 *
 * Assumes InsightFace/ArcFace-style embeddings where cosine similarity is the right metric.
 * We map cosine from [-1,1] -> [0,1] for UI convenience.
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

  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
}

/**
 * Run matching on unnamed faces and return map of faceId -> suggestions.
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


