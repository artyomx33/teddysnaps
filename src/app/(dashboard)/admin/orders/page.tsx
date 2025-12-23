"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Order {
  id: string;
  order_number: string;
  status: "pending" | "paid" | "processing" | "ready" | "delivered";
  payment_status: "pending" | "paid" | "failed";
  total: number;
  delivery_method: string;
  delivery_address: string | null;
  created_at: string;
  family: {
    family_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    product: { name: string } | null;
  }>;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

const statusConfig = {
  pending: { color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
  paid: { color: "bg-green-500/20 text-green-400", icon: CheckCircle },
  processing: { color: "bg-blue-500/20 text-blue-400", icon: Package },
  ready: { color: "bg-purple-500/20 text-purple-400", icon: Package },
  delivered: { color: "bg-green-500/20 text-green-400", icon: CheckCircle },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          payment_status,
          total,
          delivery_method,
          delivery_address,
          created_at,
          family:families (
            family_name,
            email,
            phone
          ),
          order_items:order_items (
            id,
            quantity,
            unit_price,
            product:products (
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching orders:", error);
      } else {
        const normalized: Order[] = (data || []).map((row) => {
          const r = row as unknown as Record<string, unknown>;
          const family = pickOne(r.family as unknown);
          const orderItems = (r.order_items as unknown[] | undefined) || [];

          return {
            ...(r as unknown as Order),
            family: pickOne(family as unknown) as Order["family"],
            order_items: orderItems.map((item) => {
              const it = item as Record<string, unknown>;
              return {
                ...(it as unknown as Order["order_items"][number]),
                product: pickOne(it.product as unknown) as Order["order_items"][number]["product"],
              };
            }),
          };
        });

        setOrders(normalized);
      }
      setLoading(false);
    }

    fetchOrders();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar role="admin" />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />

      <main className="flex-1 ml-64">
        <Header title="Orders" subtitle="Manage customer orders" />

        <div className="p-6">
          <div className="flex items-center justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              disabled={isBackfilling}
              onClick={async () => {
                setIsBackfilling(true);
                setBackfillMessage(null);
                try {
                  const res = await fetch("/api/retouch/backfill", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ limit: 500 }),
                  });
                  const json = (await res.json()) as any;
                  if (!json?.ok) {
                    setBackfillMessage(json?.message || "Backfill failed");
                  } else {
                    setBackfillMessage(
                      `Backfilled ${json.processedOrders} paid orders → ${json.createdTasks} retouch tasks`
                    );
                  }
                } catch {
                  setBackfillMessage("Backfill failed");
                } finally {
                  setIsBackfilling(false);
                }
              }}
            >
              {isBackfilling ? "Backfilling..." : "Backfill retouch tasks"}
            </Button>
          </div>

          {backfillMessage && (
            <div className="mb-4 text-sm text-charcoal-300">{backfillMessage}</div>
          )}

          {orders.length === 0 ? (
            <Card variant="glass" className="p-12 text-center">
              <Package className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
              <p className="text-charcoal-400">No orders yet</p>
              <p className="text-sm text-charcoal-500 mt-2">
                Orders will appear here when families purchase photos
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Orders List */}
              <div className="lg:col-span-2 space-y-3">
                {orders.map((order, index) => {
                  const StatusIcon = statusConfig[order.status]?.icon || Clock;
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        variant="default"
                        className={`p-4 cursor-pointer transition-all hover:bg-charcoal-800 ${
                          selectedOrder?.id === order.id
                            ? "ring-2 ring-gold-500"
                            : ""
                        }`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                statusConfig[order.status]?.color ||
                                "bg-charcoal-700"
                              }`}
                            >
                              <StatusIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {order.order_number}
                              </p>
                              <p className="text-sm text-charcoal-400">
                                {order.family?.family_name || "Unknown"} •{" "}
                                {formatDate(order.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-medium text-gold-500">
                              {formatPrice(order.total)}
                            </p>
                            <Badge
                              variant={
                                order.payment_status === "paid"
                                  ? "success"
                                  : "default"
                              }
                            >
                              {order.payment_status}
                            </Badge>
                            <ChevronRight className="w-5 h-5 text-charcoal-500" />
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Order Detail Panel */}
              <div className="lg:col-span-1">
                {selectedOrder ? (
                  <Card variant="glass" className="p-6 sticky top-24">
                    <h3 className="font-medium text-white mb-4">
                      Order Details
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-charcoal-400">Order Number</p>
                        <p className="text-white font-mono">
                          {selectedOrder.order_number}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-charcoal-400">Family</p>
                        <p className="text-white">
                          {selectedOrder.family?.family_name || "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-charcoal-400">Status</p>
                        <Badge
                          className={statusConfig[selectedOrder.status]?.color}
                        >
                          {selectedOrder.status}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-sm text-charcoal-400">
                          Delivery Method
                        </p>
                        <p className="text-white capitalize">
                          {selectedOrder.delivery_method?.replace("_", " ")}
                        </p>
                      </div>

                      {selectedOrder.family?.email && (
                        <div className="flex items-center gap-2 text-charcoal-300">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">
                            {selectedOrder.family.email}
                          </span>
                        </div>
                      )}

                      {selectedOrder.family?.phone && (
                        <div className="flex items-center gap-2 text-charcoal-300">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">
                            {selectedOrder.family.phone}
                          </span>
                        </div>
                      )}

                      {selectedOrder.delivery_address && (
                        <div className="flex items-start gap-2 text-charcoal-300">
                          <MapPin className="w-4 h-4 mt-0.5" />
                          <span className="text-sm">
                            {selectedOrder.delivery_address}
                          </span>
                        </div>
                      )}

                      <hr className="border-charcoal-700" />

                      <div>
                        <p className="text-sm text-charcoal-400 mb-2">Items</p>
                        <div className="space-y-2">
                          {selectedOrder.order_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-charcoal-300">
                                {item.quantity}x {item.product?.name || "Product"}
                              </span>
                              <span className="text-white">
                                {formatPrice(item.unit_price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <hr className="border-charcoal-700" />

                      <div className="flex justify-between">
                        <span className="font-medium text-white">Total</span>
                        <span className="font-medium text-gold-500">
                          {formatPrice(selectedOrder.total)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card variant="glass" className="p-6 text-center">
                    <Package className="w-8 h-8 text-charcoal-500 mx-auto mb-2" />
                    <p className="text-charcoal-400">
                      Select an order to view details
                    </p>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
