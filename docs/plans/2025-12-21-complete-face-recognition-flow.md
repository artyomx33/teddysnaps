# Complete Face Recognition Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up the complete face recognition workflow - from child enrollment with reference photos to AI matching and family gallery display.

**Architecture:**
- Family detail page shows children with ability to upload reference photos
- Reference photo upload triggers face enrollment (stores descriptor)
- After session upload, AI processes photos and matches to enrolled children
- Family gallery filters photos by matched children

**Tech Stack:** Next.js 15, Supabase, face-api.js (already installed), React

---

## Current State Analysis

### What's Already Built
- `src/lib/face-recognition/detector.ts` - Face detection with face-api.js
- `src/lib/face-recognition/matcher.ts` - Face comparison and matching logic
- `src/lib/face-recognition/processor.ts` - Batch processing with progress
- `src/lib/actions/faces.ts` - Server actions for enrollment and matching
- Upload page with "Process with AI" button (connected but no enrolled children)
- Database schema with `children.face_descriptor`, `children.reference_photo_url`, `children.is_enrolled`

### What's Missing
1. **Family detail page** - Click family to see/manage children
2. **Child enrollment UI** - Upload reference photo per child
3. **Reference photo storage bucket** - Store enrollment photos
4. **Gallery photo filtering** - Show only matched photos per family

---

## Task 1: Create Reference Photos Storage Bucket

**Files:**
- None (Supabase API call)

**Step 1: Create bucket via curl**

```bash
curl -X POST "https://lkvctypumkezgclengxj.supabase.co/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "reference-photos", "name": "reference-photos", "public": true}'
```

**Step 2: Verify bucket is public**

```bash
curl -s "https://lkvctypumkezgclengxj.supabase.co/storage/v1/bucket/reference-photos" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `"public": true`

**Step 3: Commit**

No code changes - bucket created via API.

---

## Task 2: Create Family Detail Page

**Files:**
- Create: `src/app/(dashboard)/admin/families/[familyId]/page.tsx`

**Step 1: Create the family detail page**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  User,
  Camera,
  CheckCircle,
  Upload,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { enrollChildFace } from "@/lib/actions/faces";
import { enrollChild, descriptorToArray } from "@/lib/face-recognition/processor";

interface Child {
  id: string;
  first_name: string;
  date_of_birth: string | null;
  is_enrolled: boolean;
  reference_photo_url: string | null;
}

interface Family {
  id: string;
  family_name: string;
  access_code: string;
  email: string;
  children: Child[];
}

export default function FamilyDetailPage() {
  const params = useParams();
  const familyId = params.familyId as string;
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollingChildId, setEnrollingChildId] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchFamily() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("families")
        .select(`
          id,
          family_name,
          access_code,
          email,
          children (
            id,
            first_name,
            date_of_birth,
            is_enrolled,
            reference_photo_url
          )
        `)
        .eq("id", familyId)
        .single();

      if (error) {
        console.error("Error fetching family:", error);
      } else {
        setFamily(data as Family);
      }
      setLoading(false);
    }

    fetchFamily();
  }, [familyId]);

  const handleEnrollClick = (childId: string) => {
    setEnrollingChildId(childId);
    setEnrollError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !enrollingChildId) return;

    try {
      // 1. Upload photo to Supabase storage
      const supabase = createClient();
      const filename = `${enrollingChildId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("reference-photos")
        .upload(filename, file);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("reference-photos")
        .getPublicUrl(filename);

      const photoUrl = urlData.publicUrl;

      // 3. Extract face descriptor using AI
      const descriptor = await enrollChild(photoUrl);

      if (!descriptor) {
        setEnrollError("No face detected in photo. Please try another photo with a clear face.");
        setEnrollingChildId(null);
        return;
      }

      // 4. Save to database
      await enrollChildFace(
        enrollingChildId,
        descriptorToArray(descriptor),
        photoUrl
      );

      // 5. Refresh family data
      const { data } = await supabase
        .from("families")
        .select(`
          id,
          family_name,
          access_code,
          email,
          children (
            id,
            first_name,
            date_of_birth,
            is_enrolled,
            reference_photo_url
          )
        `)
        .eq("id", familyId)
        .single();

      if (data) {
        setFamily(data as Family);
      }
    } catch (error) {
      console.error("Enrollment failed:", error);
      setEnrollError("Failed to enroll child. Please try again.");
    } finally {
      setEnrollingChildId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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

  if (!family) {
    return (
      <div className="flex min-h-screen">
        <Sidebar role="admin" />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-charcoal-400">Family not found</p>
        </main>
      </div>
    );
  }

  const enrolledCount = family.children.filter((c) => c.is_enrolled).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />

      <main className="flex-1 ml-64">
        <Header
          title={family.family_name}
          subtitle={`Access code: ${family.access_code}`}
        />

        <div className="p-6 space-y-6">
          {/* Back link */}
          <Link
            href="/admin/families"
            className="inline-flex items-center gap-2 text-charcoal-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Families
          </Link>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-charcoal-300">
              <User className="w-4 h-4" />
              <span>{family.children.length} children</span>
            </div>
            <div className="flex items-center gap-2 text-charcoal-300">
              <Camera className="w-4 h-4" />
              <span>{enrolledCount} enrolled for AI matching</span>
            </div>
          </div>

          {/* Error message */}
          {enrollError && (
            <Card variant="glass" className="border-red-500/30 bg-red-500/10">
              <CardContent className="flex items-center gap-3 py-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400">{enrollError}</p>
                <button
                  onClick={() => setEnrollError(null)}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          )}

          {/* Children Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {family.children.map((child) => (
              <Card key={child.id} variant="glass" className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Reference Photo */}
                  <div className="aspect-square bg-charcoal-800 relative">
                    {child.reference_photo_url ? (
                      <Image
                        src={child.reference_photo_url}
                        alt={child.first_name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <User className="w-16 h-16 text-charcoal-600" />
                      </div>
                    )}

                    {/* Enrollment badge */}
                    {child.is_enrolled && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Enrolled
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Child Info */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-medium text-white text-lg">
                        {child.first_name}
                      </h3>
                      {child.date_of_birth && (
                        <p className="text-sm text-charcoal-400">
                          Born {new Date(child.date_of_birth).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Enroll button */}
                    <Button
                      variant={child.is_enrolled ? "ghost" : "primary"}
                      size="sm"
                      className="w-full"
                      onClick={() => handleEnrollClick(child.id)}
                      disabled={enrollingChildId === child.id}
                    >
                      {enrollingChildId === child.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : child.is_enrolled ? (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          Update Photo
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Reference Photo
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Instructions */}
          <Card variant="glass">
            <CardContent>
              <h3 className="font-medium text-white mb-2">How Face Enrollment Works</h3>
              <ol className="text-sm text-charcoal-400 space-y-2 list-decimal list-inside">
                <li>Upload a clear reference photo of each child&apos;s face</li>
                <li>Our AI extracts unique facial features from the photo</li>
                <li>When you upload session photos, AI automatically matches faces</li>
                <li>Parents see only photos containing their children in the gallery</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Verify page loads**

Navigate to: `http://localhost:3000/admin/families/{familyId}`

Expected: Page shows family with children and "Upload Reference Photo" buttons

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/admin/families/\[familyId\]/page.tsx
git commit -m "feat: add family detail page with child enrollment UI"
```

---

## Task 3: Make Family Cards Clickable

**Files:**
- Modify: `src/app/(dashboard)/admin/families/page.tsx`

**Step 1: Wrap family cards in Link**

Find the family card rendering and wrap with Link to `/admin/families/{familyId}`:

```tsx
// Add import at top
import Link from "next/link";

// Wrap the family card (around line 370-400)
<Link
  href={`/admin/families/${family.id}`}
  className="block"
>
  <Card
    variant="glass"
    className="p-4 hover:bg-charcoal-800/50 transition-colors cursor-pointer"
  >
    {/* existing card content */}
  </Card>
</Link>
```

**Step 2: Verify navigation**

Click on "De Vries" family card.

Expected: Navigates to family detail page showing Emma and Lucas

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/admin/families/page.tsx
git commit -m "feat: make family cards clickable to view details"
```

---

## Task 4: Test End-to-End Enrollment Flow

**Files:**
- None (manual testing)

**Step 1: Create reference-photos bucket**

```bash
curl -X POST "https://lkvctypumkezgclengxj.supabase.co/storage/v1/bucket" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdmN0eXB1bWtlemdjbGVuZ3hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE4OTM0OSwiZXhwIjoyMDgxNzY1MzQ5fQ.NzsTW36uThUDsMoUT_EnRbi-W1pfsD7h2j7fQN9yV94" \
  -H "Content-Type: application/json" \
  -d '{"id": "reference-photos", "name": "reference-photos", "public": true}'
```

**Step 2: Navigate to family detail page**

Go to: `http://localhost:3000/admin/families/{de-vries-family-id}`

**Step 3: Upload reference photo for Emma**

- Click "Upload Reference Photo" on Emma's card
- Select a clear face photo
- Wait for AI processing
- Verify badge shows "Enrolled"

**Step 4: Upload reference photo for Lucas**

- Repeat for Lucas

**Step 5: Verify enrollment in database**

```bash
curl "https://lkvctypumkezgclengxj.supabase.co/rest/v1/children?select=first_name,is_enrolled,reference_photo_url" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Expected: Both children show `is_enrolled: true` and have `reference_photo_url`

---

## Task 5: Test AI Matching After Enrollment

**Files:**
- None (manual testing)

**Step 1: Go to existing session with photos**

Navigate to: `http://localhost:3000/admin/sessions/3030cd60-aac6-4420-91ef-cc47cf0d0f5e`

**Step 2: Note current state**

Photos show "No children matched yet" in detail panel

**Step 3: Go to Upload page and process**

Navigate to: `http://localhost:3000/admin/upload`
- Create new session OR use existing session ID in URL params
- Click "Process with AI"

**Step 4: Verify matches appear**

Return to session detail page and click on photos.
Expected: Matched children names appear with confidence percentages.

---

## Task 6: Update Gallery to Show Only Matched Photos

**Files:**
- Modify: `src/app/gallery/[sessionId]/[familyCode]/page.tsx`

**Step 1: Read current gallery implementation**

Check how gallery currently fetches photos.

**Step 2: Verify gallery filtering logic**

The `getPhotosForFamily` in `src/lib/actions/gallery.ts` should already filter by child matches.

If gallery shows ALL photos instead of matched ones, update the fetch logic:

```tsx
// In gallery page, ensure we're using the family-filtered query
const photos = await getPhotosForFamily(sessionId, familyId);
```

**Step 3: Test parent gallery**

Navigate to: `http://localhost:3000/gallery/{sessionId}/TEDDY123`

Expected: Only photos containing Emma or Lucas are shown (after AI processing)

**Step 4: Commit if changes made**

```bash
git add .
git commit -m "fix: filter gallery photos by matched children only"
```

---

## Summary Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN: SETUP FAMILIES                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. /admin/families → Click "Add Family"                         │
│ 2. Enter family name, email → Get access code (e.g., TEDDY123)  │
│ 3. Click family card → /admin/families/{id}                     │
│ 4. Upload reference photo for each child                        │
│    → AI extracts face descriptor → Child is "enrolled"          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN: PHOTO SESSION                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. /admin/upload → Create session                               │
│ 2. Drop photos → Upload to Supabase storage                     │
│ 3. Click "Process with AI"                                      │
│    → Detect faces in each photo                                 │
│    → Match faces to enrolled children                           │
│    → Save matches to photo_children table                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     PARENT: VIEW GALLERY                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. Parent receives gallery link or enters access code           │
│ 2. /gallery/{sessionId}/TEDDY123                                │
│ 3. Query: Get all photos where photo_children.child_id IN       │
│           (children where family.access_code = 'TEDDY123')      │
│ 4. Display only photos containing their children                │
│ 5. Parent can order prints/downloads                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Changed Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/app/(dashboard)/admin/families/[familyId]/page.tsx` | Create | Family detail with child enrollment |
| `src/app/(dashboard)/admin/families/page.tsx` | Modify | Make family cards clickable |
| Supabase bucket `reference-photos` | Create | Store child reference photos |

## Time Estimate

- Task 1 (Bucket): 2 minutes
- Task 2 (Family Detail Page): 15 minutes
- Task 3 (Clickable Cards): 5 minutes
- Task 4 (Test Enrollment): 10 minutes
- Task 5 (Test AI Matching): 5 minutes
- Task 6 (Gallery Verification): 5 minutes

**Total: ~45 minutes**
