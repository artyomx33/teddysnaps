"use server";

import { createClient } from "@/lib/supabase/server";
import { createPayment } from "@/lib/mollie/client";
import { revalidatePath } from "next/cache";

export interface OrderItem {
  photoId: string;
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  familyId: string;
  sessionId: string;
  items: OrderItem[];
  deliveryMethod: "email" | "whatsapp" | "pickup" | "delivery";
  deliveryAddress?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

/**
 * Create a new order and initiate Mollie payment
 */
export async function createOrder(input: CreateOrderInput) {
  const supabase = await createClient();

  // Fetch product prices
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, price")
    .in(
      "id",
      input.items.map((i) => i.productId)
    );

  if (productError || !products) {
    throw new Error("Failed to fetch products");
  }

  const productPrices = new Map(products.map((p) => [p.id, Number(p.price)]));

  // Calculate totals
  let subtotal = 0;
  const orderItems = input.items.map((item) => {
    const price = productPrices.get(item.productId) || 0;
    const total = price * item.quantity;
    subtotal += total;
    return {
      ...item,
      unitPrice: price,
      totalPrice: total,
    };
  });

  // Calculate discount (15% for 5+ items)
  const itemCount = input.items.reduce((sum, i) => sum + i.quantity, 0);
  const discount = itemCount >= 5 ? subtotal * 0.15 : 0;

  // Add delivery fee if applicable
  const deliveryFee = input.deliveryMethod === "delivery" ? 2.95 : 0;
  const total = subtotal - discount + deliveryFee;

  // Generate order number
  const orderNumber = `TS-${new Date().getFullYear()}-${Date.now()
    .toString()
    .slice(-6)}`;

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      family_id: input.familyId,
      session_id: input.sessionId,
      order_number: orderNumber,
      status: "pending",
      delivery_method: input.deliveryMethod,
      delivery_address: input.deliveryAddress,
      subtotal,
      discount,
      total,
      notes: input.notes,
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error("Order creation failed:", orderError);
    throw new Error("Failed to create order");
  }

  // Create order items
  const { error: itemsError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({
      order_id: order.id,
      photo_id: item.photoId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
    }))
  );

  if (itemsError) {
    console.error("Order items creation failed:", itemsError);
    // Could roll back order here, but for MVP we'll just log
  }

  // Update family contact info if provided
  if (input.email || input.phone) {
    await supabase
      .from("families")
      .update({
        email: input.email || undefined,
        phone: input.phone || undefined,
      })
      .eq("id", input.familyId);
  }

  // Create Mollie payment
  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:8001";

  try {
    const paymentUrl = await createPayment({
      orderId: order.id,
      orderNumber,
      amount: total,
      description: `TeddySnaps Order ${orderNumber}`,
      redirectUrl: `${baseUrl}/order/${order.id}/complete`,
      webhookUrl: `${baseUrl}/api/webhooks/mollie`,
      customerEmail: input.email,
    });

    revalidatePath("/admin/orders");

    return {
      orderId: order.id,
      orderNumber,
      paymentUrl,
      total,
    };
  } catch (error) {
    // Payment creation failed, but order exists
    console.error("Payment creation failed:", error);

    return {
      orderId: order.id,
      orderNumber,
      paymentUrl: null, // No payment URL - order created but payment failed
      total,
      error: "Payment creation failed",
    };
  }
}

/**
 * Get order details
 */
export async function getOrder(orderId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      family:families(family_name, email, phone),
      items:order_items(
        *,
        photo:photos(thumbnail_url, original_url),
        product:products(name, type, size)
      )
    `
    )
    .eq("id", orderId)
    .single();

  if (error) {
    console.error("Failed to fetch order:", error);
    return null;
  }

  return data;
}

/**
 * Get all orders (for admin dashboard)
 */
export async function getOrders(status?: string, limit = 50) {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      `
      *,
      family:families(family_name, email, phone),
      items:order_items(count)
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch orders:", error);
    return [];
  }

  return data || [];
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: "pending" | "paid" | "processing" | "ready" | "delivered"
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) {
    console.error("Failed to update order status:", error);
    throw new Error("Failed to update order");
  }

  revalidatePath("/admin/orders");
}

/**
 * Get order stats for dashboard
 */
export async function getOrderStats() {
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Today's orders
  const { count: todayOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today.toISOString());

  // Today's revenue
  const { data: todayRevenue } = await supabase
    .from("orders")
    .select("total")
    .gte("created_at", today.toISOString())
    .eq("payment_status", "paid");

  const revenue = (todayRevenue || []).reduce(
    (sum, o) => sum + Number(o.total),
    0
  );

  // Pending orders
  const { count: pendingOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "paid", "processing"]);

  return {
    todayOrders: todayOrders || 0,
    todayRevenue: revenue,
    pendingOrders: pendingOrders || 0,
  };
}

/**
 * Create a payment link for an existing unpaid order
 */
export async function createPaymentForOrder(orderId: string) {
  const supabase = await createClient();

  // Get the order
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_number, total, payment_status")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error("Order not found");
  }

  // Don't create payment for already paid orders
  if (order.payment_status === "paid") {
    throw new Error("Order is already paid");
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:8001";

  try {
    const paymentUrl = await createPayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amount: Number(order.total),
      description: `TeddySnaps Order ${order.order_number}`,
      redirectUrl: `${baseUrl}/order/${order.id}/complete`,
      webhookUrl: `${baseUrl}/api/webhooks/mollie`,
    });

    return { paymentUrl };
  } catch (err) {
    console.error("Failed to create payment:", err);
    throw new Error("Failed to create payment link");
  }
}
