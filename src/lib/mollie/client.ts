import createMollieClient from "@mollie/api-client";
import type { CreateParameters } from "@mollie/api-client/dist/types/binders/payments/parameters";
import type { MollieClient } from "@mollie/api-client";

// Lazy initialize to avoid build-time evaluation
let _mollieClient: MollieClient | null = null;

function getMollieClient(): MollieClient {
  if (!_mollieClient) {
    if (!process.env.MOLLIE_API_KEY) {
      throw new Error("MOLLIE_API_KEY not set - payment features require this env var");
    }
    _mollieClient = createMollieClient({
      apiKey: process.env.MOLLIE_API_KEY,
    });
  }
  return _mollieClient;
}

export const mollieClient = {
  get payments() {
    return getMollieClient().payments;
  },
  get methods() {
    return getMollieClient().methods;
  },
};

export interface CreatePaymentParams {
  orderId: string;
  orderNumber: string;
  amount: number;
  description: string;
  redirectUrl: string;
  webhookUrl?: string; // Optional - not available in local dev
  customerEmail?: string;
}

export interface CreatePaymentResult {
  paymentId: string;
  checkoutUrl: string;
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
}: CreatePaymentParams): Promise<CreatePaymentResult> {
  try {
    // Check if webhook URL is reachable (skip localhost in test mode)
    const isLocalhost = webhookUrl?.includes("localhost");

    const paymentData: CreateParameters = {
      amount: {
        currency: "EUR",
        value: amount.toFixed(2), // Mollie requires string with 2 decimals
      },
      description,
      redirectUrl,
      metadata: {
        orderId,
        orderNumber,
      },
      // Only include webhookUrl if it's not localhost (Mollie can't reach it)
      ...(webhookUrl && !isLocalhost ? { webhookUrl } : {}),
    };

    const payment = await mollieClient.payments.create(paymentData);

    return {
      paymentId: payment.id,
      checkoutUrl: payment.getCheckoutUrl() || "",
    };
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
