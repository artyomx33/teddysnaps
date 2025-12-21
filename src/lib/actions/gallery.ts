"use server";

import { createClient } from "@/lib/supabase/server";

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  isLiked: boolean;
}

export interface Family {
  id: string;
  family_name: string;
  email: string | null;
  phone: string | null;
  children: Array<{
    id: string;
    first_name: string;
  }>;
}

export interface Session {
  id: string;
  name: string;
  shoot_date: string;
  location: {
    name: string;
  };
}

// Get family by access code
export async function getFamilyByAccessCode(accessCode: string): Promise<Family | null> {
  const supabase = await createClient();

  const { data: family, error } = await supabase
    .from("families")
    .select(`
      id,
      family_name,
      email,
      phone,
      children (
        id,
        first_name
      )
    `)
    .eq("access_code", accessCode.toUpperCase())
    .single();

  if (error || !family) {
    console.error("Error fetching family:", error);
    return null;
  }

  return family;
}

// Get session with location info
export async function getSession(sessionId: string): Promise<Session | null> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("photo_sessions")
    .select(`
      id,
      name,
      shoot_date,
      location:locations (
        name
      )
    `)
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    console.error("Error fetching session:", error);
    return null;
  }

  return {
    ...session,
    location: (session.location as Array<{ name: string }>)?.[0] ?? { name: "" },
  };
}

// Get photos for a family in a session
export async function getPhotosForFamily(
  sessionId: string,
  familyId: string
): Promise<Photo[]> {
  const supabase = await createClient();

  // Get all children in the family
  const { data: children, error: childrenError } = await supabase
    .from("children")
    .select("id")
    .eq("family_id", familyId);

  if (childrenError || !children?.length) {
    console.error("Error fetching children:", childrenError);
    return [];
  }

  const childIds = children.map((c) => c.id);

  // Get photos that match any of the children
  const { data: photoMatches, error: matchError } = await supabase
    .from("photo_children")
    .select(`
      photo:photos (
        id,
        original_url,
        thumbnail_url,
        session_id
      )
    `)
    .in("child_id", childIds);

  if (matchError) {
    console.error("Error fetching photo matches:", matchError);
    return [];
  }

  // Filter to only photos from this session and deduplicate
  const photoMap = new Map<string, Photo>();

  for (const match of photoMatches || []) {
    const photoArr = match.photo as Array<{
      id: string;
      original_url: string;
      thumbnail_url: string;
      session_id: string;
    }>;
    const photo = photoArr?.[0];

    if (photo && photo.session_id === sessionId && !photoMap.has(photo.id)) {
      photoMap.set(photo.id, {
        id: photo.id,
        url: photo.original_url,
        thumbnailUrl: photo.thumbnail_url || photo.original_url,
        isLiked: false,
      });
    }
  }

  return Array.from(photoMap.values());
}

// Get all photos in a session (for sessions without face matching yet)
export async function getAllPhotosInSession(sessionId: string): Promise<Photo[]> {
  const supabase = await createClient();

  const { data: photos, error } = await supabase
    .from("photos")
    .select("id, original_url, thumbnail_url")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching photos:", error);
    return [];
  }

  return (photos || []).map((photo) => ({
    id: photo.id,
    url: photo.original_url,
    thumbnailUrl: photo.thumbnail_url || photo.original_url,
    isLiked: false,
  }));
}
