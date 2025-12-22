# Face Auto-Matching Design

## Overview

Add AI-powered auto-matching to the face naming workflow. When clicking "Match with AI", the system compares all unnamed faces against already-named faces using face descriptors and pre-fills suggestions.

## User Flow

1. Admin goes to `/admin/faces`
2. Clicks **"Match with AI"** button
3. System compares all unnamed faces against named faces (2-3 seconds)
4. Results shown in **paginated view** (20-30 faces per page)
5. Each face shows:
   - Pre-selected match if ≥85% similarity (color-coded by confidence)
   - Up to 3 alternative suggestions with percentages
   - Dropdown to change or add new name
6. Admin reviews, adjusts any wrong matches
7. Clicks **"Save Page"** → moves to next page
8. Repeat until all faces processed

## UI Design Per Face

```
┌─────────────────────────────────┐
│  [Face Image 128x128]           │
│                                 │
│  Pre-selected: father 1  (92%)  │  ← Green (95%+) or Yellow (85-94%)
│  ─────────────────────────────  │
│  Also similar:                  │
│    • mother 1 (78%)             │  ← Gray, just informational
│    • kid 3 (71%)                │
│                                 │
│  [Dropdown: father 1 ▼]         │  ← Can change selection
└─────────────────────────────────┘
```

### Color Coding

| Confidence | Color  | Meaning |
|------------|--------|---------|
| 95%+       | Green  | High confidence, likely correct |
| 85-94%     | Yellow | Good match, worth reviewing |
| <85%       | None   | No pre-selection, manual review needed |

## Sorting

Faces sorted by **photo number** (from filename or upload order). Similar faces are often in consecutive photos, making review easier.

## Technical Implementation

### 1. Matching Algorithm

```typescript
function matchFaces(unnamedFaces, namedFaces) {
  // For each unnamed face
  for (face of unnamedFaces) {
    const matches = [];

    // Compare against all named faces
    for (named of namedFaces) {
      const distance = euclideanDistance(face.descriptor, named.descriptor);
      const similarity = 1 - distance; // Convert to percentage

      if (similarity > 0.5) { // Only consider if >50% similar
        matches.push({ childId: named.childId, name: named.name, similarity });
      }
    }

    // Sort by similarity, take top 3
    face.suggestions = matches.sort((a, b) => b.similarity - a.similarity).slice(0, 3);

    // Pre-select if top match ≥85%
    if (face.suggestions[0]?.similarity >= 0.85) {
      face.selectedChildId = face.suggestions[0].childId;
    }
  }
}
```

### 2. Euclidean Distance

Face descriptors are 128-dimensional Float32Arrays from face-api.js.

```typescript
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// face-api.js typical distances:
// Same person: 0.0 - 0.4 (60-100% similarity)
// Different person: 0.5 - 1.0+ (0-50% similarity)
// Threshold 0.6 distance ≈ 0.85 similarity for our UI
```

### 3. Data Flow

```
[Match with AI clicked]
        ↓
[Fetch all unnamed faces with descriptors]  ← Server action
        ↓
[Fetch all named faces with descriptors]    ← Server action
        ↓
[Run matching algorithm]                     ← Client-side (fast)
        ↓
[Update UI state with suggestions]
        ↓
[Render paginated results]
```

### 4. New Server Action

```typescript
// Get all faces with descriptors for matching
export async function getFacesForMatching(sessionId: string) {
  const supabase = await createClient();

  // Get unnamed faces
  const { data: unnamed } = await supabase
    .from("discovered_faces")
    .select("id, photo_id, crop_url, face_descriptor")
    .eq("session_id", sessionId)
    .eq("is_named", false)
    .eq("is_skipped", false)
    .order("photo_id"); // Sort by photo for grouping

  // Get named faces (reference for matching)
  const { data: named } = await supabase
    .from("discovered_faces")
    .select("id, child_id, face_descriptor, children(first_name)")
    .eq("session_id", sessionId)
    .eq("is_named", true);

  return { unnamed, named };
}
```

### 5. UI Components

**New/Modified:**
- `MatchWithAIButton` - Triggers matching, shows loading state
- `FaceCardWithSuggestions` - Shows face with suggestions and confidence
- `Pagination` - Navigate pages of 20-30 faces
- `SavePageButton` - Save current page selections

## Performance Considerations

- **Matching**: O(n × m) where n=unnamed, m=named. For 4000×50 = 200k comparisons, still <100ms
- **Bottleneck**: Fetching face descriptors from DB (~1-2 seconds for 4000 faces)
- **Pagination**: Only render 20-30 images at a time for smooth scrolling

## Edge Cases

1. **No named faces yet**: Show message "Name a few faces first to enable auto-matching"
2. **No matches found**: Face shows empty dropdown, user must select manually
3. **All faces already named**: "Match with AI" button disabled or hidden
4. **Multiple faces same person**: All get same suggestion (correct behavior)

## Files to Modify

1. `src/lib/actions/faces.ts` - Add `getFacesForMatching` action
2. `src/components/faces/face-naming.tsx` - Add matching UI, pagination, suggestions
3. `src/lib/face-recognition/matcher.ts` - (New) Euclidean distance + matching logic

## Success Criteria

- [ ] "Match with AI" processes all faces in <3 seconds
- [ ] Faces with ≥85% match are pre-selected
- [ ] Up to 3 suggestions shown per face with percentages
- [ ] Color coding shows confidence level
- [ ] Pagination works smoothly (20-30 per page)
- [ ] "Save Page" saves current page and advances
