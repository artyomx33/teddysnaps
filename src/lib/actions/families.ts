"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Set or clear the done status for a family
 * done=true sets done_at to now(), done=false clears it
 */
export async function setFamilyDoneStatus(familyId: string, done: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("families")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", familyId);

  if (error) {
    console.error("Error setting family done status:", error);
    throw new Error("Failed to set family done status");
  }

  revalidatePath("/admin/families");
  revalidatePath(`/admin/families/${familyId}`);
}

/**
 * Set the hero photo for a family
 * Used by admins to pick a representative photo from matched photos
 */
export async function setFamilyHeroPhoto(familyId: string, photoId: string | null) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("families")
    .update({ hero_photo_id: photoId })
    .eq("id", familyId);

  if (error) {
    console.error("Error setting family hero photo:", error);
    throw new Error("Failed to set family hero photo");
  }

  revalidatePath("/admin/families");
  revalidatePath(`/admin/families/${familyId}`);
}

/**
 * Get family with hero photo details
 */
export async function getFamilyWithHeroPhoto(familyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("families")
    .select(`
      id,
      family_name,
      access_code,
      email,
      hero_photo_id,
      hero_photo:photos!hero_photo_id (
        id,
        original_url,
        thumbnail_url
      ),
      children (
        id,
        first_name,
        reference_photo_url
      )
    `)
    .eq("id", familyId)
    .single();

  if (error) {
    console.error("Error fetching family:", error);
    return null;
  }

  return data;
}
