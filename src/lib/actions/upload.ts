"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPhotoSession(data: {
  name: string;
  shootDate: string;
  locationId: string;
}) {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("photo_sessions")
    .insert({
      name: data.name,
      shoot_date: data.shootDate,
      location_id: data.locationId,
      status: "processing",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating session:", error);
    throw new Error("Failed to create photo session");
  }

  revalidatePath("/admin");
  return session;
}

export async function uploadPhoto(
  sessionId: string,
  formData: FormData
): Promise<{
  id: string;
  thumbnailUrl: string;
  originalUrl: string;
}> {
  const supabase = await createClient();
  const file = formData.get("file") as File;

  if (!file) {
    throw new Error("No file provided");
  }

  const filename = `${sessionId}/${Date.now()}-${file.name}`;

  // Upload original
  const { error: uploadError } = await supabase.storage
    .from("photos-originals")
    .upload(filename, file);

  if (uploadError) {
    console.error("Upload error:", uploadError);
    throw new Error("Failed to upload photo");
  }

  // Get URLs
  const { data: originalData } = supabase.storage
    .from("photos-originals")
    .getPublicUrl(filename);

  // For thumbnails, we'd normally resize here, but for MVP use original
  const { data: thumbnailData } = supabase.storage
    .from("photos-originals")
    .getPublicUrl(filename);

  // Create photo record
  const { data: photo, error: dbError } = await supabase
    .from("photos")
    .insert({
      session_id: sessionId,
      original_url: originalData.publicUrl,
      thumbnail_url: thumbnailData.publicUrl,
      filename: file.name,
    })
    .select()
    .single();

  if (dbError) {
    console.error("DB error:", dbError);
    throw new Error("Failed to save photo record");
  }

  return {
    id: photo.id,
    thumbnailUrl: thumbnailData.publicUrl,
    originalUrl: originalData.publicUrl,
  };
}

export async function getLocations() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("Error fetching locations:", error);
    return [];
  }

  return data || [];
}

export async function createLocation(name: string, slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .insert({ name, slug })
    .select()
    .single();

  if (error) {
    console.error("Error creating location:", error);
    throw new Error("Failed to create location");
  }

  revalidatePath("/admin");
  return data;
}

export async function updateSessionStatus(
  sessionId: string,
  status: "processing" | "ready" | "archived"
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("photo_sessions")
    .update({ status })
    .eq("id", sessionId);

  if (error) {
    console.error("Error updating session:", error);
    throw new Error("Failed to update session status");
  }

  revalidatePath("/admin");
}

export async function getSessionPhotos(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("photos")
    .select("id, original_url, thumbnail_url")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching session photos:", error);
    return [];
  }

  return data || [];
}
