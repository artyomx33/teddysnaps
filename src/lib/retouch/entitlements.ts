"use server";

import { createAdminClient } from "@/lib/supabase/admin";

type OrderRow = {
  id: string;
  family_id: string;
  session_id: string;
  payment_status: "pending" | "paid" | "failed";
};

type OrderItemRow = {
  order_id: string;
  photo_id: string | null;
  product_id: string;
  quantity: number;
};

async function getFamilyConfirmedPhotoIdsForSession(input: {
  familyId: string;
  sessionId: string;
}): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: children, error: childrenError } = await supabase
    .from("children")
    .select("id")
    .eq("family_id", input.familyId);

  if (childrenError || !children?.length) return [];
  const childIds = children.map((c: any) => c.id as string);

  const { data: matches, error: matchesError } = await supabase
    .from("photo_children")
    .select(
      `
      photo_id,
      photo:photos!inner (
        id,
        session_id
      )
    `
    )
    .eq("is_confirmed", true)
    .in("child_id", childIds);

  if (matchesError || !matches?.length) return [];

  const ids = new Set<string>();
  for (const m of matches as any[]) {
    const photo = Array.isArray(m.photo) ? m.photo?.[0] : m.photo;
    if (photo?.session_id === input.sessionId && typeof m.photo_id === "string") {
      ids.add(m.photo_id);
    }
  }

  return Array.from(ids);
}

export async function createEntitlementsAndRetouchTasksForOrder(orderId: string): Promise<
  | { ok: true; createdEntitlements: number; createdTasks: number }
  | { ok: false; message: string }
> {
  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, family_id, session_id, payment_status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) return { ok: false, message: "Order not found" };
  const o = order as unknown as OrderRow;
  if (o.payment_status !== "paid") return { ok: false, message: "Order is not paid" };

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id, photo_id, product_id, quantity")
    .eq("order_id", o.id);

  if (itemsError) return { ok: false, message: "Failed to load order items" };
  const orderItems = (items || []) as unknown as OrderItemRow[];

  const hasBundle = orderItems.some((it) => it.photo_id === null);
  const photoIds = new Set<string>();

  // Per-photo purchases
  for (const it of orderItems) {
    if (typeof it.photo_id === "string" && it.photo_id.length > 0) {
      photoIds.add(it.photo_id);
    }
  }

  // Bundle expands to ALL confirmed photos for family+session
  if (hasBundle) {
    const expanded = await getFamilyConfirmedPhotoIdsForSession({
      familyId: o.family_id,
      sessionId: o.session_id,
    });
    for (const id of expanded) photoIds.add(id);
  }

  if (photoIds.size === 0) return { ok: true, createdEntitlements: 0, createdTasks: 0 };

  // Determine product_id for entitlements (use first bundle or per-photo product)
  const bundleItem = orderItems.find((it) => it.photo_id === null);
  const perPhotoItem = orderItems.find((it) => it.photo_id !== null);
  const productIdForEntitlements = bundleItem?.product_id || perPhotoItem?.product_id;

  if (!productIdForEntitlements) {
    return { ok: false, message: "No product found in order items" };
  }

  // Create entitlements and retouch tasks
  let createdEntitlements = 0;
  let createdTasks = 0;

  for (const photoId of photoIds) {
    const source = hasBundle && !orderItems.some((it) => it.photo_id === photoId)
      ? "bundle"
      : "per_photo";

    // Upsert entitlement
    const { data: entitlement, error: entitlementError } = await supabase
      .from("photo_entitlements")
      .upsert(
        {
          order_id: o.id,
          family_id: o.family_id,
          session_id: o.session_id,
          photo_id: photoId,
          product_id: productIdForEntitlements,
          source,
        },
        { onConflict: "family_id,photo_id", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (!entitlementError && entitlement) {
      createdEntitlements += 1;

      // Upsert retouch task
      const { error: taskError } = await supabase
        .from("retouch_tasks")
        .upsert(
          {
            entitlement_id: entitlement.id,
            order_id: o.id,
            family_id: o.family_id,
            session_id: o.session_id,
            photo_id: photoId,
            status: "queued",
          },
          { onConflict: "family_id,photo_id", ignoreDuplicates: true }
        );

      if (!taskError) {
        createdTasks += 1;
      }
    }
  }

  return { ok: true, createdEntitlements, createdTasks };
}

export async function backfillPaidOrdersRetouch(limit = 200): Promise<
  | { ok: true; processedOrders: number; createdEntitlements: number; createdTasks: number }
  | { ok: false; message: string }
> {
  const supabase = createAdminClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { ok: false, message: "Failed to load paid orders" };

  let ent = 0;
  let tasks = 0;
  let processed = 0;

  for (const row of orders || []) {
    processed += 1;
    const res = await createEntitlementsAndRetouchTasksForOrder((row as any).id as string);
    if (res.ok) {
      ent += res.createdEntitlements;
      tasks += res.createdTasks;
    }
  }

  return { ok: true, processedOrders: processed, createdEntitlements: ent, createdTasks: tasks };
}
