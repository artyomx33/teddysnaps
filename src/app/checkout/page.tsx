"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CartSummary, DeliveryForm } from "@/components/checkout";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { useCartStore } from "@/stores";
import { createOrder } from "@/lib/actions/orders";
import { formatPrice } from "@/lib/utils";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, familyId, sessionId, getTotal, clearCart } = useCartStore();

  const [deliveryMethod, setDeliveryMethod] = useState("email");
  const [contact, setContact] = useState<{
    email?: string;
    phone?: string;
    address?: string;
  }>({});
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = getTotal();
  const deliveryFee = deliveryMethod === "delivery" ? 2.95 : 0;
  const grandTotal = total + deliveryFee;

  const canSubmit =
    items.length > 0 &&
    deliveryMethod &&
    (deliveryMethod === "email" || deliveryMethod === "pickup"
      ? contact.email
      : deliveryMethod === "whatsapp"
      ? contact.phone
      : contact.email && contact.address);

  const handleSubmit = async () => {
    if (!canSubmit || !familyId || !sessionId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createOrder({
        familyId,
        sessionId,
        items: items.map((item) => ({
          photoId: item.photoId,
          productId: item.productId,
          quantity: item.quantity,
        })),
        deliveryMethod: deliveryMethod as "email" | "whatsapp" | "pickup" | "delivery",
        deliveryAddress: contact.address,
        email: contact.email,
        phone: contact.phone,
        notes: notes || undefined,
      });

      if (result.paymentUrl) {
        // Redirect to Mollie payment page
        clearCart();
        window.location.href = result.paymentUrl;
      } else {
        // No payment URL (payment creation failed or testing mode)
        // Redirect to order confirmation
        clearCart();
        router.push(`/order/${result.orderId}/complete`);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-gold-500 mx-auto mb-4" />
            <h1 className="text-xl font-serif text-white mb-2">
              Your cart is empty
            </h1>
            <p className="text-charcoal-400 mb-6">
              Browse the gallery to add photos to your selection.
            </p>
            <Link href="/">
              <Button variant="primary">Go to Gallery</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-charcoal-900/80 backdrop-blur-xl border-b border-charcoal-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="javascript:history.back()"
            className="p-2 text-charcoal-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-serif text-white">Checkout</h1>
            <p className="text-sm text-charcoal-400">
              Complete your order
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Cart & Delivery */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CartSummary />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <DeliveryForm
                selectedMethod={deliveryMethod}
                onDeliveryMethodChange={setDeliveryMethod}
                onContactChange={setContact}
              />
            </motion.div>
          </div>

          {/* Right: Order Summary & Payment */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card variant="glow">
                <CardContent className="space-y-4">
                  <h3 className="text-lg font-medium text-white">
                    Order Summary
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-charcoal-400">
                      <span>Subtotal</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-charcoal-400">
                        <span>Delivery</span>
                        <span>{formatPrice(deliveryFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-medium text-white pt-2 border-t border-charcoal-700">
                      <span>Total</span>
                      <span className="text-gold-500">
                        {formatPrice(grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="pt-4 border-t border-charcoal-700">
                    <Input
                      label="Order Notes (optional)"
                      placeholder="Any special requests..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  {/* Pay Button */}
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={!canSubmit || isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay {formatPrice(grandTotal)}
                      </>
                    )}
                  </Button>

                  {/* Payment Methods */}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <span className="text-xs text-charcoal-500">
                      Secure payment via
                    </span>
                    <span className="text-xs font-medium text-charcoal-400">
                      iDEAL • Credit Card • Bancontact
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-charcoal-400">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔒</span>
                      <span>Secure checkout</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💳</span>
                      <span>Powered by Mollie</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
