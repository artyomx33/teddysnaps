import { NextRequest, NextResponse } from "next/server";
import { mollieClient } from "@/lib/mollie/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function extractOrderIdFromMetadata(metadata: unknown): string | null {
  if (!metadata) return null;
  if (typeof metadata === "object") {
    const orderId = (metadata as Record<string, unknown>).orderId;
    return typeof orderId === "string" && orderId.length > 0 ? orderId : null;
  }
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata) as Record<string, unknown>;
      const orderId = parsed?.orderId;
      return typeof orderId === "string" && orderId.length > 0 ? orderId : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function extractPaymentId(request: NextRequest): Promise<string | null> {
  // Mollie usually sends: application/x-www-form-urlencoded with body "id=tr_..."
  // But we accept JSON too (some proxies/tests).
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as unknown;
      if (body && typeof body === "object") {
        const id = (body as Record<string, unknown>).id;
        return typeof id === "string" && id.length > 0 ? id : null;
      }
      return null;
    }

    const formData = await request.formData();
    const id = formData.get("id");
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    // Fallback: best-effort parse raw body (urlencoded)
    try {
      const text = await request.text();
      const match = text.match(/(?:^|&)id=([^&]+)/);
      if (!match) return null;
      return decodeURIComponent(match[1] || "");
    } catch {
      return null;
    }
  }
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  try {
    const paymentId = await extractPaymentId(request);

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing payment ID" },
        { status: 400 }
      );
    }

    // Get payment from Mollie
    const payment = await mollieClient.payments.get(paymentId);

    // Extract order ID from metadata
    const orderId = extractOrderIdFromMetadata(payment.metadata);

    if (!orderId) {
      console.error("No orderId in payment metadata");
      return NextResponse.json(
        { error: "Invalid payment metadata" },
        { status: 400 }
      );
    }

    // Determine new status based on Mollie payment status
    let paymentStatus: "pending" | "paid" | "failed" = "pending";
    let orderStatus: string | null = null;

    // Treat as string to be resilient to API/type differences across Mollie versions.
    const mollieStatus = payment.status as unknown as string;

    switch (mollieStatus) {
      case "paid":
        paymentStatus = "paid";
        orderStatus = "paid";
        break;
      case "failed":
      case "canceled":
      case "expired":
      case "charged_back":
        paymentStatus = "failed";
        break;
      // 'pending', 'open', 'authorized' stay as pending
    }

    // Update order in database
    const updateData: Record<string, unknown> = {
      payment_id: paymentId,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    };

    if (orderStatus) {
      updateData.status = orderStatus;
    }

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("Failed to update order:", error);
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      );
    }

    console.log(
      `Payment ${paymentId} for order ${orderId}: ${payment.status}`
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
