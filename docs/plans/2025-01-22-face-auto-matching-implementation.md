# Face Auto-Matching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Match with AI" button that auto-matches unnamed faces against named faces using face descriptors, pre-filling suggestions with confidence scores.

**Architecture:** Client-side matching using existing face descriptors stored in DB. Server action fetches all faces with descriptors, client runs Euclidean distance comparisons, UI displays ranked suggestions with color-coded confidence.

**Tech Stack:** React, TypeScript, Supabase, face-api.js (for euclideanDistance), Tailwind CSS

---

## Task 1: Add Server Action to Fetch Faces with Descriptors

**Files:**
- Modify: `src/lib/actions/faces.ts`

**Step 1: Add the getFacesForMatching function**

Add this function after `getFaceCounts` (around line 378):

```typescript
/**
 * Get all faces with descriptors for AI matching
 * Returns unnamed faces and named faces (as reference)
 */
export async function getFacesForMatching(sessionId: string) {
  const supabase = await createClient();

  // Get unnamed faces with descriptors
  const { data: unnamed, error: unnamedError } = await supabase
    .from("discovered_faces")
    .select("id, photo_id, crop_url, face_descriptor")
    .eq("session_id", sessionId)
    .eq("is_named", false)
    .eq("is_skipped", false)
    .not("face_descriptor", "is", null)
    .order("photo_id");

  if (unnamedError) {
    console.error("Error fetching unnamed faces:", unnamedError);
    return { unnamed: [], named: [] };
  }

  // Get named faces as reference (with child info)
  const { data: named, error: namedError } = await supabase
    .from("discovered_faces")
    .select(`
      id,
      child_id,
      face_descriptor,
      children (
        id,
        first_name,
        families (
          family_name
        )
      )
    `)
    .eq("session_id", sessionId)
    .eq("is_named", true)
    .not("face_descriptor", "is", null);

  if (namedError) {
    console.error("Error fetching named faces:", namedError);
    return { unnamed: unnamed || [], named: [] };
  }

  return {
    unnamed: unnamed || [],
    named: named || [],
  };
}
```

**Step 2: Verify the function compiles**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10`
Expected: No errors related to getFacesForMatching

**Step 3: Commit**

```bash
git add src/lib/actions/faces.ts
git commit -m "feat: add getFacesForMatching server action for AI matching"
```

---

## Task 2: Add Matching Utility Function

**Files:**
- Modify: `src/lib/face-recognition/matcher.ts`

**Step 1: Add the findTopMatches function**

Add after the existing `findAllMatches` function (around line 76):

```typescript
export interface SuggestedMatch {
  childId: string;
  childName: string;
  familyName: string;
  similarity: number; // 0-1, higher is better
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
  minSimilarity: number = 0.5
): SuggestedMatch[] {
  const matches: SuggestedMatch[] = [];

  for (const named of namedFaces) {
    // Calculate Euclidean distance
    let sum = 0;
    for (let i = 0; i < faceDescriptor.length; i++) {
      sum += (faceDescriptor[i] - named.descriptor[i]) ** 2;
    }
    const distance = Math.sqrt(sum);

    // Convert distance to similarity (0-1)
    // face-api.js distances: 0-0.4 = same person, 0.6+ = different
    // Map 0->1, 0.6->0.4, 1.0->0
    const similarity = Math.max(0, 1 - distance);

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
```

**Step 2: Export the new types and functions**

The file already uses named exports, so they're automatically available.

**Step 3: Verify build**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/face-recognition/matcher.ts
git commit -m "feat: add findTopMatches and matchAllFaces for AI matching"
```

---

## Task 3: Update FaceGroup Interface and State

**Files:**
- Modify: `src/components/faces/face-naming.tsx`

**Step 1: Update imports**

Add to imports at top of file:

```typescript
import { Wand2 } from "lucide-react"; // Add to existing lucide imports
import { getFacesForMatching } from "@/lib/actions/faces"; // Add to existing imports
import { matchAllFaces, SuggestedMatch } from "@/lib/face-recognition/matcher";
```

**Step 2: Update FaceGroup interface**

Replace existing FaceGroup interface (around line 34):

```typescript
interface FaceGroup {
  clusterId: string;
  faces: Array<{ id: string; cropUrl: string; descriptor?: number[] }>;
  selectedChildId: string | null;
  newChildName: string;
  isCreatingNew: boolean;
  isSkipped: boolean;
  suggestions: SuggestedMatch[]; // NEW: AI suggestions
}
```

**Step 3: Add matching state**

Add after the existing state declarations (around line 63):

```typescript
const [isMatching, setIsMatching] = useState(false);
const [hasMatched, setHasMatched] = useState(false);
```

**Step 4: Update initial FaceGroup creation in loadData**

In the `loadData` function, update the groups mapping (around line 149):

```typescript
const groups: FaceGroup[] = Array.from(groupedByCluster.entries()).map(
  ([clusterId, faces]) => ({
    clusterId,
    faces,
    selectedChildId: null,
    newChildName: "",
    isCreatingNew: false,
    isSkipped: false,
    suggestions: [], // NEW: empty until AI matching
  })
);
```

**Step 5: Verify build**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/faces/face-naming.tsx
git commit -m "feat: add suggestions to FaceGroup interface and matching state"
```

---

## Task 4: Add Match with AI Handler

**Files:**
- Modify: `src/components/faces/face-naming.tsx`

**Step 1: Add the handleMatchWithAI function**

Add after `handleUndo` function (around line 234):

```typescript
const handleMatchWithAI = async () => {
  setIsMatching(true);

  try {
    // Fetch faces with descriptors
    const { unnamed, named } = await getFacesForMatching(sessionId);

    if (named.length === 0) {
      alert("No named faces to match against. Name a few faces first!");
      setIsMatching(false);
      return;
    }

    // Prepare named faces for matching
    const namedForMatching = named.map((f: any) => ({
      childId: f.child_id,
      childName: f.children?.first_name || "Unknown",
      familyName: f.children?.families?.family_name || "",
      descriptor: f.face_descriptor as number[],
    }));

    // Prepare unnamed faces for matching
    const unnamedForMatching = unnamed.map((f: any) => ({
      id: f.id,
      descriptor: f.face_descriptor as number[],
    }));

    // Run AI matching (client-side, fast!)
    const matchResults = matchAllFaces(unnamedForMatching, namedForMatching);

    // Update face groups with suggestions
    setFaceGroups((prev) =>
      prev.map((group) => {
        // Find matches for any face in this group
        const faceId = group.faces[0]?.id;
        if (!faceId) return group;

        // Look up by clusterId first (if clustered), then by face id
        const suggestions = matchResults.get(group.clusterId) || matchResults.get(faceId) || [];

        // Auto-select if top match is >= 85%
        const topMatch = suggestions[0];
        const autoSelect = topMatch && topMatch.similarity >= 0.85 ? topMatch.childId : null;

        return {
          ...group,
          suggestions,
          selectedChildId: autoSelect || group.selectedChildId,
        };
      })
    );

    setHasMatched(true);
  } catch (error) {
    console.error("Error during AI matching:", error);
    alert("Failed to run AI matching. Please try again.");
  } finally {
    setIsMatching(false);
  }
};
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/faces/face-naming.tsx
git commit -m "feat: add handleMatchWithAI function for AI face matching"
```

---

## Task 5: Add Match with AI Button to Header

**Files:**
- Modify: `src/components/faces/face-naming.tsx`

**Step 1: Add the button to header**

In the header section (around line 318), add the Match with AI button before the other buttons:

```typescript
<div className="flex items-center gap-3">
  {/* NEW: Match with AI button */}
  {!hasMatched && faceGroups.length > 0 && (
    <Button
      variant="outline"
      onClick={handleMatchWithAI}
      disabled={isMatching}
    >
      {isMatching ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Wand2 className="w-4 h-4 mr-2" />
      )}
      {isMatching ? "Matching..." : "Match with AI"}
    </Button>
  )}

  {hasMatched && (
    <Badge variant="success" className="py-1">
      <Check className="w-3 h-3 mr-1" />
      AI Matched
    </Badge>
  )}

  {lastAction && (
    // ... existing Undo button
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/faces/face-naming.tsx
git commit -m "feat: add Match with AI button to face naming header"
```

---

## Task 6: Display Suggestions with Confidence Colors

**Files:**
- Modify: `src/components/faces/face-naming.tsx`

**Step 1: Add confidence color helper**

Add after the imports (around line 27):

```typescript
function getConfidenceColor(similarity: number): string {
  if (similarity >= 0.95) return "bg-teal-500 text-white"; // Green - high confidence
  if (similarity >= 0.85) return "bg-amber-500 text-white"; // Yellow - good match
  return "bg-charcoal-600 text-charcoal-300"; // Gray - low confidence
}

function formatSimilarity(similarity: number): string {
  return `${Math.round(similarity * 100)}%`;
}
```

**Step 2: Update the face card to show suggestions**

Replace the name buttons section (around line 434-457) with:

```typescript
{/* Name buttons */}
{!group.isSkipped && (
  <div className="space-y-2">
    {/* AI Suggestions (if available) */}
    {group.suggestions.length > 0 && (
      <div className="space-y-1">
        {group.suggestions.map((suggestion, idx) => (
          <button
            key={suggestion.childId}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectChild(group.clusterId, suggestion.childId);
            }}
            className={cn(
              "w-full px-3 py-1.5 text-sm rounded-lg transition-all flex items-center justify-between",
              group.selectedChildId === suggestion.childId
                ? getConfidenceColor(suggestion.similarity)
                : idx === 0 && suggestion.similarity >= 0.85
                ? getConfidenceColor(suggestion.similarity) + " ring-2 ring-offset-2 ring-offset-charcoal-900"
                : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
            )}
          >
            <span>{suggestion.childName}</span>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              suggestion.similarity >= 0.85 ? "bg-black/20" : "bg-charcoal-700"
            )}>
              {formatSimilarity(suggestion.similarity)}
            </span>
          </button>
        ))}
      </div>
    )}

    {/* Existing children as pressable buttons (when no AI suggestions) */}
    {group.suggestions.length === 0 && (
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
    )}

    {/* Actions row */}
    <div className="flex gap-2 pt-2 border-t border-charcoal-700">
      {/* ... existing new/skip buttons unchanged ... */}
```

**Step 3: Verify build**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/faces/face-naming.tsx
git commit -m "feat: display AI suggestions with confidence colors"
```

---

## Task 7: Add Pagination

**Files:**
- Modify: `src/components/faces/face-naming.tsx`

**Step 1: Add pagination state**

Add after the existing state declarations:

```typescript
const [currentPage, setCurrentPage] = useState(0);
const FACES_PER_PAGE = 24;
```

**Step 2: Calculate paginated faces**

Add after the pagination state:

```typescript
const totalPages = Math.ceil(faceGroups.length / FACES_PER_PAGE);
const paginatedGroups = faceGroups.slice(
  currentPage * FACES_PER_PAGE,
  (currentPage + 1) * FACES_PER_PAGE
);
```

**Step 3: Update the grid to use paginatedGroups**

Replace `faceGroups.map` with `paginatedGroups.map` in the grid (around line 379).

**Step 4: Add pagination controls**

Add after the grid (before the closing `</div>` of the main container):

```typescript
{/* Pagination */}
{totalPages > 1 && (
  <div className="flex items-center justify-center gap-4 pt-4">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
      disabled={currentPage === 0}
    >
      Previous
    </Button>
    <span className="text-charcoal-400">
      Page {currentPage + 1} of {totalPages}
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
      disabled={currentPage === totalPages - 1}
    >
      Next
    </Button>
  </div>
)}
```

**Step 5: Update namedCount to only count current page for "Save Page"**

```typescript
const pageNamedCount = paginatedGroups.filter(
  (g) => g.selectedChildId || (g.isCreatingNew && g.newChildName.trim()) || g.isSkipped
).length;
```

**Step 6: Update Save button text**

Change "Save All ({namedCount})" to "Save Page ({pageNamedCount})" and update `handleSaveAll` to only save current page, then auto-advance.

**Step 7: Verify build**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10`
Expected: No errors

**Step 8: Commit**

```bash
git add src/components/faces/face-naming.tsx
git commit -m "feat: add pagination for face naming (24 per page)"
```

---

## Task 8: Integration Test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test the flow**

1. Go to `/admin/faces`
2. Verify existing named faces are visible (you named 6 earlier)
3. Click "Match with AI" button
4. Verify loading state appears
5. Verify suggestions appear with percentages
6. Verify high-confidence matches (95%+) show green
7. Verify good matches (85-94%) show yellow
8. Verify pagination works
9. Test "Save Page" saves only current page
10. Verify saved faces disappear from list

**Step 3: Commit final polish if needed**

```bash
git add -A
git commit -m "feat: complete AI face matching with pagination and confidence display"
```

---

## Success Criteria Checklist

- [ ] "Match with AI" button appears and works
- [ ] Matching completes in <3 seconds
- [ ] Suggestions show up to 3 matches per face
- [ ] Percentages display correctly
- [ ] Green color for 95%+ confidence
- [ ] Yellow color for 85-94% confidence
- [ ] Faces 85%+ are auto-selected
- [ ] Pagination shows 24 faces per page
- [ ] "Save Page" saves current page only
- [ ] After save, page advances or shows completion
