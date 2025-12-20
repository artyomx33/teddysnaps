"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Get all enrolled children with their face descriptors
 */
export async function getEnrolledChildren() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("children")
    .select("id, first_name, face_descriptor, family_id")
    .eq("is_enrolled", true)
    .not("face_descriptor", "is", null);

  if (error) {
    console.error("Error fetching enrolled children:", error);
    return [];
  }

  return (data || []).map((child) => ({
    id: child.id,
    firstName: child.first_name,
    familyId: child.family_id,
    descriptor: new Float32Array(child.face_descriptor as number[]),
  }));
}

/**
 * Enroll a child with their face descriptor
 */
export async function enrollChildFace(
  childId: string,
  descriptor: number[],
  referencePhotoUrl: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("children")
    .update({
      face_descriptor: descriptor,
      reference_photo_url: referencePhotoUrl,
      is_enrolled: true,
    })
    .eq("id", childId);

  if (error) {
    console.error("Error enrolling child:", error);
    throw new Error("Failed to enroll child");
  }

  revalidatePath("/admin/families");
}

/**
 * Save photo-child matches from AI processing
 */
export async function savePhotoMatches(
  matches: Array<{ photoId: string; childId: string; confidence: number }>
) {
  const supabase = await createClient();

  // Insert matches (with upsert to handle duplicates)
  const { error } = await supabase.from("photo_children").upsert(
    matches.map((match) => ({
      photo_id: match.photoId,
      child_id: match.childId,
      confidence: match.confidence,
      is_confirmed: false, // AI matches are not confirmed by default
    })),
    { onConflict: "photo_id,child_id" }
  );

  if (error) {
    console.error("Error saving photo matches:", error);
    throw new Error("Failed to save photo matches");
  }

  // Update photos that had no matches as needing review
  const photoIds = [...new Set(matches.map((m) => m.photoId))];
  await supabase
    .from("photos")
    .update({ needs_review: false })
    .in("id", photoIds);

  revalidatePath("/admin");
}

/**
 * Update photo needs_review status
 */
export async function updatePhotoReviewStatus(
  photoIds: string[],
  needsReview: boolean
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("photos")
    .update({ needs_review: needsReview })
    .in("id", photoIds);

  if (error) {
    console.error("Error updating review status:", error);
    throw new Error("Failed to update review status");
  }
}

/**
 * Confirm a photo-child match (after manual review)
 */
export async function confirmMatch(photoId: string, childId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("photo_children")
    .update({ is_confirmed: true })
    .eq("photo_id", photoId)
    .eq("child_id", childId);

  if (error) {
    console.error("Error confirming match:", error);
    throw new Error("Failed to confirm match");
  }
}

/**
 * Remove a photo-child match
 */
export async function removeMatch(photoId: string, childId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("photo_children")
    .delete()
    .eq("photo_id", photoId)
    .eq("child_id", childId);

  if (error) {
    console.error("Error removing match:", error);
    throw new Error("Failed to remove match");
  }
}

/**
 * Get photos for a specific child (for gallery)
 */
export async function getPhotosForChild(childId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("photo_children")
    .select(
      `
      photo_id,
      confidence,
      is_confirmed,
      photos (
        id,
        original_url,
        thumbnail_url,
        session_id
      )
    `
    )
    .eq("child_id", childId);

  if (error) {
    console.error("Error fetching photos for child:", error);
    return [];
  }

  return data || [];
}

/**
 * Get photos for a family (all children)
 */
export async function getPhotosForFamily(familyId: string) {
  const supabase = await createClient();

  // First get all children in the family
  const { data: children, error: childError } = await supabase
    .from("children")
    .select("id")
    .eq("family_id", familyId);

  if (childError || !children) {
    console.error("Error fetching children:", childError);
    return [];
  }

  const childIds = children.map((c) => c.id);

  // Then get all photos matched to these children
  const { data, error } = await supabase
    .from("photo_children")
    .select(
      `
      photo_id,
      child_id,
      confidence,
      is_confirmed,
      photos (
        id,
        original_url,
        thumbnail_url,
        session_id,
        photo_sessions (
          name,
          shoot_date
        )
      )
    `
    )
    .in("child_id", childIds);

  if (error) {
    console.error("Error fetching family photos:", error);
    return [];
  }

  return data || [];
}
