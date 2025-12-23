"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  location_id?: string;
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

export interface Product {
  id: string;
  name: string;
  type: "digital" | "print" | "canvas" | "book";
  price: number;
  description: string | null;
}

export async function getPricedProducts(): Promise<Product[]> {
  // Use service role so parent gallery can always read pricing even if RLS is not applied yet.
  const supabase = createAdminClient();
  // IMPORTANT: Do not filter by price in PostgREST. We've seen cases where numeric filters
  // unexpectedly return empty sets depending on column type/casting. Filter in code instead.
  const { data, error } = await supabase
    .from("products")
    .select("id, name, type, price, description")
    .order("price", { ascending: true });

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  const normalized = (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    price: Number(p.price),
    description: p.description ?? null,
  })) as Product[];

  const priced = normalized.filter((p) => Number.isFinite(p.price) && p.price > 0);

  // Debug signal for misconfiguration: pricing exists in DB but filter results empty.
  if (normalized.length > 0 && priced.length === 0) {
    console.warn("[getPricedProducts] products exist but none are priced > 0", {
      total: normalized.length,
      sample: normalized.slice(0, 3).map((p) => ({ id: p.id, name: p.name, price: p.price })),
    });
  }

  return priced;
}

// Get family by access code
export async function getFamilyByAccessCode(accessCode: string): Promise<Family | null> {
  const supabase = await createClient();

  const { data: family, error } = await supabase
    .from("families")
    .select(`
      id,
      location_id,
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

export async function getSessionsForLocation(locationId: string): Promise<Session[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("photo_sessions")
    .select(`
      id,
      name,
      shoot_date,
      location:locations (name)
    `)
    .eq("location_id", locationId)
    .order("shoot_date", { ascending: false });

  if (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }

  return (data || []).map((s: any) => ({
    ...s,
    location: (s.location as Array<{ name: string }>)?.[0] ?? { name: "" },
  })) as Session[];
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

  // Get confirmed photos that match any of the children (parent gallery shows confirmed only)
  const { data: photoMatches, error: matchError } = await supabase
    .from("photo_children")
    .select(`
      is_confirmed,
      photo:photos!inner (
        id,
        original_url,
        thumbnail_url,
        session_id
      )
    `)
    .eq("is_confirmed", true)
    .in("child_id", childIds);

  if (matchError) {
    console.error("Error fetching photo matches:", matchError);
    return [];
  }

  // Filter to only photos from this session and deduplicate
  const photoMap = new Map<string, Photo>();

  for (const match of photoMatches || []) {
    // PostgREST embed shapes can be either object or array depending on relationship/cardinality.
    // We alias as `photo:photos!inner`, which is usually a single object.
    const row = match as unknown as {
      is_confirmed?: boolean;
      photo?:
        | {
            id: string;
            original_url: string;
            thumbnail_url: string | null;
            session_id: string;
          }
        | Array<{
            id: string;
            original_url: string;
            thumbnail_url: string | null;
            session_id: string;
          }>;
    };

    const photo = Array.isArray(row.photo) ? row.photo?.[0] : row.photo;

    const isConfirmed = row.is_confirmed === true;

    if (photo && photo.session_id === sessionId && isConfirmed && !photoMap.has(photo.id)) {
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
