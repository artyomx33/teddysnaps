import createMollieClient from "@mollie/api-client";

if (!process.env.MOLLIE_API_KEY) {
  console.warn("MOLLIE_API_KEY not set - payment features will not work");
}

export const mollieClient = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY || "test_placeholder",
});

export interface CreatePaymentParams {
  orderId: string;
  orderNumber: string;
  amount: number;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  customerEmail?: string;
}

/**
 * Create a Mollie payment for an order
 */
export async function createPayment({
  orderId,
  orderNumber,
  amount,
  description,
  redirectUrl,
  webhookUrl,
  customerEmail,
}: CreatePaymentParams): Promise<string> {
  try {
    const payment = await mollieClient.payments.create({
      amount: {
        currency: "EUR",
        value: amount.toFixed(2), // Mollie requires string with 2 decimals
      },
      description,
      redirectUrl,
      webhookUrl,
      metadata: {
        orderId,
        orderNumber,
      },
    });

    return payment.getCheckoutUrl() || "";
  } catch (error) {
    console.error("Failed to create Mollie payment:", error);
    throw new Error("Failed to create payment");
  }
}

/**
 * Get payment status from Mollie
 */
export async function getPaymentStatus(
  paymentId: string
): Promise<{
  status: string;
  isPaid: boolean;
  paidAt: string | null;
  amount: string;
}> {
  try {
    const payment = await mollieClient.payments.get(paymentId);

    return {
      status: payment.status,
      isPaid: payment.status === "paid",
      paidAt: payment.paidAt || null,
      amount: payment.amount.value,
    };
  } catch (error) {
    console.error("Failed to get payment status:", error);
    throw new Error("Failed to get payment status");
  }
}

/**
 * List available payment methods
 */
export async function getPaymentMethods() {
  try {
    const methods = await mollieClient.methods.list({
      amount: {
        currency: "EUR",
        value: "10.00",
      },
    });

    return methods.map((method) => ({
      id: method.id,
      description: method.description,
      image: method.image?.size2x || method.image?.size1x,
    }));
  } catch (error) {
    console.error("Failed to get payment methods:", error);
    return [];
  }
}
