"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  ShoppingCart,
  Users,
  Camera,
  TrendingUp,
  Calendar,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";

interface Stats {
  todayOrders: number;
  todayRevenue: number;
  totalFamilies: number;
  weekPhotos: number;
  pendingOrders: number;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  family: Array<{ family_name: string }> | null;
  order_items: Array<{ quantity: number; product_name: string }>;
}

interface Session {
  id: string;
  name: string;
  shoot_date: string;
  total_photos: number;
  status: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    todayOrders: 0,
    todayRevenue: 0,
    totalFamilies: 0,
    weekPhotos: 0,
    pendingOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Fetch all data in parallel
    const [
      ordersRes,
      familiesRes,
      photosRes,
      recentOrdersRes,
      sessionsRes,
    ] = await Promise.all([
      // Today's orders
      supabase
        .from("orders")
        .select("id, total_amount, status")
        .gte("created_at", today),
      // Total families
      supabase.from("families").select("id", { count: "exact" }),
      // Photos this week
      supabase
        .from("photos")
        .select("id", { count: "exact" })
        .gte("created_at", weekAgo),
      // Recent orders with details
      supabase
        .from("orders")
        .select(`
          id,
          order_number,
          total_amount,
          status,
          created_at,
          family:families (family_name),
          order_items (quantity, product_name)
        `)
        .order("created_at", { ascending: false })
        .limit(5),
      // Recent sessions
      supabase
        .from("photo_sessions")
        .select("id, name, shoot_date, total_photos, status")
        .order("shoot_date", { ascending: false })
        .limit(5),
    ]);

    const todayOrders = ordersRes.data || [];
    const pendingOrders = todayOrders.filter((o) => o.status === "pending").length;
    const todayRevenue = todayOrders.reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    );

    setStats({
      todayOrders: todayOrders.length,
      todayRevenue,
      totalFamilies: familiesRes.count || 0,
      weekPhotos: photosRes.count || 0,
      pendingOrders,
    });

    setRecentOrders(recentOrdersRes.data || []);
    setRecentSessions(sessionsRes.data || []);
    setLoading(false);
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      month: "short",
      day: "numeric",
    });
  };

  const statsConfig = [
    {
      label: "Today's Orders",
      value: stats.todayOrders.toString(),
      change: stats.pendingOrders > 0 ? `${stats.pendingOrders} pending` : "",
      icon: ShoppingCart,
      color: "gold",
    },
    {
      label: "Revenue Today",
      value: formatPrice(stats.todayRevenue),
      change: "",
      icon: TrendingUp,
      color: "teal",
    },
    {
      label: "Registered Families",
      value: stats.totalFamilies.toString(),
      change: "",
      icon: Users,
      color: "gold",
    },
    {
      label: "Photos This Week",
      value: stats.weekPhotos.toString(),
      change: "",
      icon: Camera,
      color: "teal",
    },
  ];

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
        <Header title="Dashboard" subtitle="Welcome back, Photographer" />

        <div className="p-6 space-y-8">
          {/* Quick Actions */}
          <div className="flex gap-4">
            <Link href="/admin/upload">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card
                  variant="glow"
                  className="cursor-pointer hover:border-gold-500/50 transition-all"
                >
                  <CardContent className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gold-500/20 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-gold-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Upload Photos</p>
                      <p className="text-sm text-charcoal-400">
                        Start a new session
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link href="/admin/orders">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card className="cursor-pointer hover:border-charcoal-600 transition-all">
                  <CardContent className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Manage Orders</p>
                      <p className="text-sm text-charcoal-400">
                        {stats.pendingOrders > 0
                          ? `${stats.pendingOrders} pending orders`
                          : "View all orders"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link href="/admin/families">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card className="cursor-pointer hover:border-charcoal-600 transition-all">
                  <CardContent className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Manage Families</p>
                      <p className="text-sm text-charcoal-400">
                        {stats.totalFamilies} families registered
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsConfig.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardContent>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-charcoal-400">{stat.label}</p>
                        <p className="text-3xl font-serif text-white mt-1">
                          {stat.value}
                        </p>
                        {stat.change && (
                          <p className="text-sm text-yellow-400 mt-1">
                            {stat.change}
                          </p>
                        )}
                      </div>
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          stat.color === "gold"
                            ? "bg-gold-500/20"
                            : "bg-teal-500/20"
                        }`}
                      >
                        <stat.icon
                          className={`w-5 h-5 ${
                            stat.color === "gold"
                              ? "text-gold-500"
                              : "text-teal-400"
                          }`}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">
                    Recent Orders
                  </h3>
                  <Link
                    href="/admin/orders"
                    className="text-sm text-gold-500 hover:text-gold-400 flex items-center gap-1"
                  >
                    View all
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                {recentOrders.length === 0 ? (
                  <p className="text-charcoal-500 text-center py-8">
                    No orders yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href="/admin/orders"
                        className="flex items-center justify-between p-3 bg-charcoal-800/50 rounded-lg hover:bg-charcoal-800 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {order.family?.[0]?.family_name || "Unknown"}
                          </p>
                          <p className="text-sm text-charcoal-400">
                            {order.order_items
                              ?.map((i) => `${i.quantity}x ${i.product_name}`)
                              .join(", ") || "No items"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white">
                            {formatPrice(order.total_amount)}
                          </p>
                          <Badge
                            variant={
                              order.status === "paid"
                                ? "success"
                                : order.status === "pending"
                                ? "warning"
                                : "default"
                            }
                          >
                            {order.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Sessions */}
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">
                    Recent Sessions
                  </h3>
                  <Link
                    href="/admin/upload"
                    className="text-sm text-gold-500 hover:text-gold-400 flex items-center gap-1"
                  >
                    New session
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                {recentSessions.length === 0 ? (
                  <p className="text-charcoal-500 text-center py-8">
                    No sessions yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentSessions.map((session) => (
                      <Link
                        key={session.id}
                        href={`/admin/sessions/${session.id}`}
                        className="flex items-center justify-between p-3 bg-charcoal-800/50 rounded-lg hover:bg-charcoal-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-charcoal-700 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-charcoal-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {session.name}
                            </p>
                            <p className="text-sm text-charcoal-400">
                              {formatDate(session.shoot_date)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-charcoal-400">
                            {session.total_photos} photos
                          </p>
                          <Badge
                            variant={
                              session.status === "ready" ? "success" : "default"
                            }
                          >
                            {session.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
