import { NextRequest, NextResponse } from "next/server";
import { mollieClient } from "@/lib/mollie/client";
import { createClient } from "@supabase/supabase-js";

// Create client inside function to avoid build-time evaluation
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const formData = await request.formData();
    const paymentId = formData.get("id") as string;

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing payment ID" },
        { status: 400 }
      );
    }

    // Get payment from Mollie
    const payment = await mollieClient.payments.get(paymentId);

    // Extract order ID from metadata
    const orderId = (payment.metadata as Record<string, unknown>)?.orderId as string;

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

    switch (payment.status) {
      case "paid":
        paymentStatus = "paid";
        orderStatus = "paid";
        break;
      case "failed":
      case "canceled":
      case "expired":
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
