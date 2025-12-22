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

/**
 * Save discovered faces to database
 * Uses upsert to prevent duplicates on re-run
 * Returns face IDs for clustering
 */
export async function saveDiscoveredFaces(
  sessionId: string,
  faces: Array<{
    photoId: string;
    descriptor: number[];
    cropUrl: string;
    bbox: { x: number; y: number; width: number; height: number };
    detectionScore: number;
  }>
): Promise<string[]> {
  const supabase = await createClient();

  const insertData = faces.map(face => ({
    session_id: sessionId,
    photo_id: face.photoId,
    face_descriptor: face.descriptor,
    crop_url: face.cropUrl,
    detection_score: face.detectionScore,
    bbox_x: face.bbox.x,
    bbox_y: face.bbox.y,
    bbox_width: face.bbox.width,
    bbox_height: face.bbox.height,
    is_named: false,
    is_skipped: false,
  }));

  // Use upsert to handle re-runs (same bbox = same face)
  const { data, error } = await supabase
    .from("discovered_faces")
    .upsert(insertData, {
      onConflict: "photo_id,bbox_x,bbox_y,bbox_width,bbox_height",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    console.error("Error saving discovered faces:", error);
    throw new Error("Failed to save discovered faces");
  }

  revalidatePath("/admin/faces");

  return data?.map(d => d.id) || [];
}

/**
 * Get all discovered faces for a session
 */
export async function getDiscoveredFaces(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discovered_faces")
    .select(`
      id,
      photo_id,
      face_descriptor,
      crop_url,
      detection_score,
      bbox_x,
      bbox_y,
      bbox_width,
      bbox_height,
      cluster_id,
      child_id,
      confidence,
      is_named,
      is_skipped,
      children (id, first_name)
    `)
    .eq("session_id", sessionId)
    .order("created_at");

  if (error) {
    console.error("Error fetching discovered faces:", error);
    return [];
  }

  return data || [];
}

/**
 * Get unnamed faces for a session (for the naming UI)
 */
export async function getUnnamedFaces(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discovered_faces")
    .select(`
      id,
      photo_id,
      crop_url,
      cluster_id,
      detection_score
    `)
    .eq("session_id", sessionId)
    .eq("is_named", false)
    .eq("is_skipped", false)
    .order("cluster_id");

  if (error) {
    console.error("Error fetching unnamed faces:", error);
    return [];
  }

  return data || [];
}

/**
 * Update cluster assignments for faces
 */
export async function updateFaceClusters(
  assignments: Array<{ faceId: string; clusterId: string }>
) {
  const supabase = await createClient();

  // Batch update using Promise.all
  await Promise.all(
    assignments.map(({ faceId, clusterId }) =>
      supabase
        .from("discovered_faces")
        .update({ cluster_id: clusterId })
        .eq("id", faceId)
    )
  );

  revalidatePath("/admin/faces");
}

/**
 * Name a cluster (assign all faces in cluster to a child)
 * CRITICAL: Also creates photo_children records for parent gallery!
 */
export async function nameCluster(
  clusterId: string,
  childId: string,
  sessionId: string
) {
  const supabase = await createClient();

  // 1. Get all faces in this cluster
  const { data: faces, error: fetchError } = await supabase
    .from("discovered_faces")
    .select("id, photo_id, face_descriptor")
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId);

  if (fetchError || !faces) {
    console.error("Error fetching cluster faces:", fetchError);
    throw new Error("Failed to fetch cluster faces");
  }

  // 2. Update discovered_faces
  const { error: updateError } = await supabase
    .from("discovered_faces")
    .update({
      child_id: childId,
      is_named: true,
      confidence: 1.0, // Manual assignment = 100% confidence
    })
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId);

  if (updateError) {
    console.error("Error naming cluster:", updateError);
    throw new Error("Failed to name cluster");
  }

  // 3. CRITICAL: Create photo_children records for parent gallery!
  const photoIds = [...new Set(faces.map(f => f.photo_id))];

  const photoChildrenData = photoIds.map(photoId => ({
    photo_id: photoId,
    child_id: childId,
    confidence: 1.0,
    is_confirmed: true, // Manual assignment = confirmed
  }));

  // Upsert to handle duplicates (child might already be in photo from another face)
  const { error: pcError } = await supabase
    .from("photo_children")
    .upsert(photoChildrenData, {
      onConflict: "photo_id,child_id",
      ignoreDuplicates: true,
    });

  if (pcError) {
    console.error("Error creating photo_children:", pcError);
    throw new Error("Failed to link photos to child");
  }

  revalidatePath("/admin/faces");
  revalidatePath("/admin/sessions");
  revalidatePath("/gallery"); // Parent gallery needs refresh!
}

/**
 * Skip a face (mark as "not a face" or irrelevant)
 */
export async function skipFace(faceId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("discovered_faces")
    .update({ is_skipped: true, is_named: true })
    .eq("id", faceId);

  if (error) {
    console.error("Error skipping face:", error);
    throw new Error("Failed to skip face");
  }

  revalidatePath("/admin/faces");
}

/**
 * Skip all faces in a cluster
 */
export async function skipCluster(clusterId: string, sessionId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("discovered_faces")
    .update({ is_skipped: true, is_named: true })
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId);

  if (error) {
    console.error("Error skipping cluster:", error);
    throw new Error("Failed to skip cluster");
  }

  revalidatePath("/admin/faces");
}

/**
 * Undo last naming action (revert a cluster back to unnamed)
 */
export async function undoClusterNaming(clusterId: string, sessionId: string) {
  const supabase = await createClient();

  // 1. Get the child_id before we clear it
  const { data: faces } = await supabase
    .from("discovered_faces")
    .select("child_id, photo_id")
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId)
    .limit(1);

  const childId = faces?.[0]?.child_id;

  // 2. Revert discovered_faces
  const { error } = await supabase
    .from("discovered_faces")
    .update({
      child_id: null,
      is_named: false,
      is_skipped: false,
      confidence: null,
    })
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId);

  if (error) {
    console.error("Error undoing cluster naming:", error);
    throw new Error("Failed to undo naming");
  }

  // 3. Remove photo_children records (only if no other faces link them)
  if (childId) {
    const photoIds = faces?.map(f => f.photo_id) || [];
    for (const photoId of photoIds) {
      // Check if there are other named faces linking this photo to this child
      const { count } = await supabase
        .from("discovered_faces")
        .select("*", { count: "exact", head: true })
        .eq("photo_id", photoId)
        .eq("child_id", childId)
        .eq("is_named", true);

      if (count === 0) {
        await supabase
          .from("photo_children")
          .delete()
          .eq("photo_id", photoId)
          .eq("child_id", childId);
      }
    }
  }

  revalidatePath("/admin/faces");
  revalidatePath("/gallery");
}

/**
 * Create a new child and assign to cluster
 * (Auto-create family per child approach)
 */
export async function createChildFromCluster(
  clusterId: string,
  sessionId: string,
  firstName: string,
  locationId: string
) {
  const supabase = await createClient();

  // Generate access code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let accessCode = "TEDDY";
  for (let i = 0; i < 3; i++) {
    accessCode += chars[Math.floor(Math.random() * chars.length)];
  }

  // Create family for this child
  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({
      family_name: firstName,
      location_id: locationId,
      access_code: accessCode,
    })
    .select()
    .single();

  if (familyError) {
    console.error("Error creating family:", familyError);
    throw new Error("Failed to create family");
  }

  // Get representative face descriptor for enrollment
  const { data: face } = await supabase
    .from("discovered_faces")
    .select("face_descriptor, crop_url")
    .eq("cluster_id", clusterId)
    .eq("session_id", sessionId)
    .limit(1)
    .single();

  // Create child with face descriptor (auto-enrolled!)
  const { data: child, error: childError } = await supabase
    .from("children")
    .insert({
      family_id: family.id,
      first_name: firstName,
      face_descriptor: face?.face_descriptor,
      reference_photo_url: face?.crop_url,
      is_enrolled: true,
    })
    .select()
    .single();

  if (childError) {
    console.error("Error creating child:", childError);
    throw new Error("Failed to create child");
  }

  // Now name the cluster with this new child
  await nameCluster(clusterId, child.id, sessionId);

  revalidatePath("/admin/families");

  return { family, child };
}

/**
 * Get all existing children for naming (grouped by location)
 */
export async function getChildrenForNaming(locationId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("children")
    .select(`
      id,
      first_name,
      families (
        id,
        family_name,
        location_id
      )
    `)
    .order("first_name");

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching children:", error);
    return [];
  }

  // Filter by location if provided
  if (locationId) {
    return (data || []).filter((c: any) => c.families?.location_id === locationId);
  }

  return data || [];
}
