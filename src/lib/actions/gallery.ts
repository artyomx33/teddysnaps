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

export async function setPhotoLike(input: {
  sessionId: string;
  familyCode: string;
  photoId: string;
  liked: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const sessionId = input.sessionId.trim();
  const familyCode = input.familyCode.trim().toUpperCase();
  const photoId = input.photoId.trim();

  if (!sessionId || !familyCode || !photoId) {
    return { ok: false, message: "Missing sessionId/familyCode/photoId" };
  }

  const supabase = createAdminClient();

  // Verify family by access code (we don't trust client-provided familyId)
  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id")
    .eq("access_code", familyCode)
    .maybeSingle();

  if (familyError || !family) {
    return { ok: false, message: "Invalid access code" };
  }

  // Verify photo belongs to this family for this session (confirmed match).
  const { data: children, error: childrenError } = await supabase
    .from("children")
    .select("id")
    .eq("family_id", family.id);

  if (childrenError || !children?.length) {
    return { ok: false, message: "Family has no children" };
  }

  const childIds = children.map((c: any) => c.id as string);

  const { data: match, error: matchError } = await supabase
    .from("photo_children")
    .select(
      `
      id,
      photo:photos!inner (
        id,
        session_id
      )
    `
    )
    .eq("photo_id", photoId)
    .eq("is_confirmed", true)
    .in("child_id", childIds)
    .limit(1)
    .maybeSingle();

  const matchPhoto = (match as any)?.photo;
  const matchPhotoSessionId = Array.isArray(matchPhoto)
    ? matchPhoto?.[0]?.session_id
    : matchPhoto?.session_id;

  if (matchError || !match || matchPhotoSessionId !== sessionId) {
    return { ok: false, message: "Photo not available for this family" };
  }

  if (input.liked) {
    const { error } = await supabase.from("photo_likes").upsert(
      {
        family_id: family.id,
        photo_id: photoId,
      },
      { onConflict: "family_id,photo_id", ignoreDuplicates: true }
    );
    if (error) return { ok: false, message: "Failed to save like" };
  } else {
    const { error } = await supabase
      .from("photo_likes")
      .delete()
      .eq("family_id", family.id)
      .eq("photo_id", photoId);
    if (error) return { ok: false, message: "Failed to remove like" };
  }

  return { ok: true };
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

  const base = Array.from(photoMap.values());

  // Hydrate likes (hearts) for this family.
  // Use service role so parent gallery always loads even if RLS is enabled.
  const admin = createAdminClient();
  const photoIds = base.map((p) => p.id);
  if (photoIds.length === 0) return base;

  const { data: likes, error: likesError } = await admin
    .from("photo_likes")
    .select("photo_id")
    .eq("family_id", familyId)
    .in("photo_id", photoIds);

  if (likesError || !likes) return base;

  const likedSet = new Set(likes.map((l: any) => l.photo_id as string));
  return base.map((p) => ({ ...p, isLiked: likedSet.has(p.id) }));
}

/**
 * Get all photo IDs that a family has purchased (paid orders only)
 */
export async function getPurchasedPhotoIds(familyId: string): Promise<Set<string>> {
  const supabase = createAdminClient();

  // Get all paid orders for this family
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("family_id", familyId)
    .eq("payment_status", "paid");

  if (ordersError || !orders?.length) {
    return new Set();
  }

  const orderIds = orders.map((o: any) => o.id as string);

  // Get all order items for these orders
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("photo_id")
    .in("order_id", orderIds)
    .not("photo_id", "is", null);

  if (itemsError || !items?.length) {
    return new Set();
  }

  return new Set(items.map((i: any) => i.photo_id as string));
}

/**
 * Get purchased photos with full details (for order confirmation page)
 */
export async function getPurchasedPhotosForOrder(orderId: string): Promise<Array<{
  id: string;
  thumbnailUrl: string;
  originalUrl: string;
}>> {
  const supabase = createAdminClient();

  const { data: items, error } = await supabase
    .from("order_items")
    .select(`
      photo_id,
      photo:photos (
        id,
        thumbnail_url,
        original_url
      )
    `)
    .eq("order_id", orderId)
    .not("photo_id", "is", null);

  if (error || !items?.length) {
    return [];
  }

  return items
    .filter((item: any) => item.photo)
    .map((item: any) => {
      const photo = Array.isArray(item.photo) ? item.photo[0] : item.photo;
      return {
        id: photo.id,
        thumbnailUrl: photo.thumbnail_url || photo.original_url,
        originalUrl: photo.original_url,
      };
    });
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

/**
 * Get retouched photos uploaded for a family (is_retouched = true)
 */
export async function getRetouchedPhotosForFamily(
  familyId: string
): Promise<Array<{ id: string; url: string; thumbnailUrl: string; filename: string | null }>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("photos")
    .select("id, original_url, thumbnail_url, filename")
    .eq("family_id", familyId)
    .eq("is_retouched", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching retouched photos:", error);
    return [];
  }

  return (data || []).map((photo: any) => ({
    id: photo.id,
    url: photo.original_url,
    thumbnailUrl: photo.thumbnail_url || photo.original_url,
    filename: photo.filename,
  }));
}
