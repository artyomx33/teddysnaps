import { NextRequest, NextResponse } from "next/server";
import { mollieClient } from "@/lib/mollie/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEntitlementsAndRetouchTasksForOrder } from "@/lib/retouch/entitlements";
import { sendOrderConfirmationEmail } from "@/lib/email/send";

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

    // If paid, generate entitlements + retouch tasks (idempotent via upserts)
    if (paymentStatus === "paid") {
      const res = await createEntitlementsAndRetouchTasksForOrder(orderId);
      if (!res.ok) {
        console.error("[mollie webhook] Failed to create retouch tasks:", res.message);
      }

      // Send order confirmation email
      try {
        // Fetch order details with family and children info
        const { data: orderData } = await supabase
          .from("orders")
          .select(`
            id,
            total_amount,
            session_id,
            family:families!inner (
              id,
              email,
              parent_name,
              children (
                id,
                first_name
              )
            )
          `)
          .eq("id", orderId)
          .single();

        if (orderData?.family) {
          // Family comes as object from !inner join
          const familyRaw = orderData.family as unknown as {
            id: string;
            email: string | null;
            parent_name: string | null;
            children: Array<{ id: string; first_name: string }>;
          };

          // Count entitlements for this order
          const { count: photoCount } = await supabase
            .from("photo_entitlements")
            .select("id", { count: "exact", head: true })
            .eq("order_id", orderId);

          if (familyRaw.email) {
            const childName = familyRaw.children?.[0]?.first_name || "je kind";
            const parentName = familyRaw.parent_name || "Ouder";
            const baseUrl = process.env.NEXT_PUBLIC_URL || "https://snaps.teddykids.nl";

            // Get family code for gallery URL
            const { data: familyData } = await supabase
              .from("families")
              .select("access_code")
              .eq("id", familyRaw.id)
              .single();

            const galleryUrl = familyData?.access_code
              ? `${baseUrl}/gallery/${orderData.session_id}/${familyData.access_code}`
              : baseUrl;

            const emailResult = await sendOrderConfirmationEmail({
              to: familyRaw.email,
              parentName,
              childName,
              photoCount: photoCount || 0,
              totalAmount: `€${(orderData.total_amount / 100).toFixed(2).replace(".", ",")}`,
              galleryUrl,
            });

            if (emailResult.ok) {
              console.log(`[mollie webhook] Order confirmation email sent to ${familyRaw.email}`);
            } else {
              console.error(`[mollie webhook] Failed to send email: ${emailResult.error}`);
            }
          }
        }
      } catch (emailError) {
        // Don't fail the webhook if email fails
        console.error("[mollie webhook] Error sending confirmation email:", emailError);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
