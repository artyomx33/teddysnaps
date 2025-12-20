"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Clock,
  XCircle,
  Home,
  ShoppingBag,
  Mail,
  MessageCircle,
  Building,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { getOrder } from "@/lib/actions/orders";
import { formatPrice, formatDate } from "@/lib/utils";

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  delivery_method: string;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  family: {
    family_name: string;
    email: string;
    phone: string;
  };
  items: Array<{
    quantity: number;
    unit_price: number;
    total_price: number;
    product: {
      name: string;
      type: string;
    };
    photo: {
      thumbnail_url: string;
    };
  }>;
}

const deliveryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  whatsapp: MessageCircle,
  pickup: Building,
  delivery: Truck,
};

const deliveryLabels: Record<string, string> = {
  email: "Email delivery",
  whatsapp: "WhatsApp delivery",
  pickup: "Pickup at TeddyKids",
  delivery: "Home delivery",
};

export default function OrderCompletePage() {
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const data = await getOrder(orderId);
        setOrder(data as Order);
      } catch (error) {
        console.error("Failed to fetch order:", error);
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-charcoal-400">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-serif text-white mb-2">
              Order not found
            </h1>
            <p className="text-charcoal-400 mb-6">
              We couldn&apos;t find this order. It may have been deleted or the link
              is incorrect.
            </p>
            <Link href="/">
              <Button variant="primary">Return Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = order.payment_status === "paid";
  const isPending = order.payment_status === "pending";
  const isFailed = order.payment_status === "failed";

  const DeliveryIcon = deliveryIcons[order.delivery_method] || Mail;

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* Status Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          {isPaid && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-10 h-10 text-green-500" />
              </motion.div>
              <h1 className="text-3xl font-serif text-white mb-2">
                Thank You!
              </h1>
              <p className="text-charcoal-400">
                Your order has been confirmed
              </p>
            </>
          )}

          {isPending && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Clock className="w-10 h-10 text-amber-500" />
              </motion.div>
              <h1 className="text-3xl font-serif text-white mb-2">
                Payment Pending
              </h1>
              <p className="text-charcoal-400">
                We&apos;re waiting for your payment to complete
              </p>
            </>
          )}

          {isFailed && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <XCircle className="w-10 h-10 text-red-500" />
              </motion.div>
              <h1 className="text-3xl font-serif text-white mb-2">
                Payment Failed
              </h1>
              <p className="text-charcoal-400">
                Something went wrong with your payment
              </p>
            </>
          )}
        </motion.div>

        {/* Order Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card variant="glass">
            <CardContent className="space-y-6">
              {/* Order Number */}
              <div className="flex items-center justify-between pb-4 border-b border-charcoal-700">
                <div>
                  <p className="text-sm text-charcoal-400">Order Number</p>
                  <p className="text-lg font-medium text-white">
                    {order.order_number}
                  </p>
                </div>
                <Badge
                  variant={
                    isPaid
                      ? "success"
                      : isPending
                      ? "warning"
                      : "error"
                  }
                >
                  {isPaid ? "Paid" : isPending ? "Pending" : "Failed"}
                </Badge>
              </div>

              {/* Items */}
              <div>
                <p className="text-sm text-charcoal-400 mb-3">Items</p>
                <div className="space-y-3">
                  {order.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 bg-charcoal-800/50 rounded-lg"
                    >
                      <div className="w-12 h-12 rounded overflow-hidden">
                        <img
                          src={item.photo?.thumbnail_url || "/placeholder.jpg"}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-white">{item.product?.name}</p>
                        <p className="text-sm text-charcoal-400">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="text-white">
                        {formatPrice(item.total_price)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery */}
              <div className="flex items-center gap-3 p-3 bg-charcoal-800/50 rounded-lg">
                <DeliveryIcon className="w-5 h-5 text-gold-500" />
                <span className="text-white">
                  {deliveryLabels[order.delivery_method]}
                </span>
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-4 border-t border-charcoal-700">
                <div className="flex justify-between text-charcoal-400">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>-{formatPrice(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-medium text-white pt-2">
                  <span>Total</span>
                  <span className="text-gold-500">
                    {formatPrice(order.total)}
                  </span>
                </div>
              </div>

              {/* Family */}
              <div className="pt-4 border-t border-charcoal-700">
                <p className="text-sm text-charcoal-400">Order for</p>
                <p className="text-white">{order.family?.family_name} family</p>
                {order.family?.email && (
                  <p className="text-sm text-charcoal-400">
                    {order.family.email}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 mt-8"
        >
          <Link href="/" className="flex-1">
            <Button variant="outline" size="lg" className="w-full">
              <Home className="w-5 h-5 mr-2" />
              Return Home
            </Button>
          </Link>
          {isFailed && (
            <Link href="/checkout" className="flex-1">
              <Button variant="primary" size="lg" className="w-full">
                <ShoppingBag className="w-5 h-5 mr-2" />
                Try Again
              </Button>
            </Link>
          )}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-charcoal-500 text-sm mt-8"
        >
          Questions? Contact us at photos@teddykids.nl
        </motion.p>
      </main>
    </div>
  );
}
