"use client";

import { motion } from "framer-motion";
import {
  Upload,
  ShoppingCart,
  Users,
  Camera,
  TrendingUp,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Badge } from "@/components/ui";

// Demo stats - will be replaced with real data
const stats = [
  {
    label: "Today's Orders",
    value: "12",
    change: "+3",
    icon: ShoppingCart,
    color: "gold",
  },
  {
    label: "Revenue Today",
    value: "€186",
    change: "+22%",
    icon: TrendingUp,
    color: "teal",
  },
  {
    label: "Active Families",
    value: "47",
    change: "+5",
    icon: Users,
    color: "gold",
  },
  {
    label: "Photos This Week",
    value: "892",
    change: "",
    icon: Camera,
    color: "teal",
  },
];

const recentOrders = [
  {
    id: "1",
    family: "Van Berg",
    items: "3 prints",
    status: "pending",
    total: "€13.50",
  },
  {
    id: "2",
    family: "De Vries",
    items: "2 digital",
    status: "ready",
    total: "€5.00",
  },
  {
    id: "3",
    family: "Jansen",
    items: "5 prints + 2 digital",
    status: "processing",
    total: "€27.50",
  },
];

const recentSessions = [
  { id: "1", name: "December Portraits", date: "Dec 18", photos: 147, status: "ready" },
  { id: "2", name: "Winter Activities", date: "Dec 15", photos: 203, status: "ready" },
  { id: "3", name: "Art Class", date: "Dec 12", photos: 89, status: "archived" },
];

export default function AdminDashboard() {
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
                        5 pending orders
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
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
                          <p className="text-sm text-green-400 mt-1">
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
                    className="text-sm text-gold-500 hover:text-gold-400"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-charcoal-800/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-white">{order.family}</p>
                        <p className="text-sm text-charcoal-400">
                          {order.items}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">{order.total}</p>
                        <Badge
                          variant={
                            order.status === "ready"
                              ? "success"
                              : order.status === "pending"
                              ? "warning"
                              : "teal"
                          }
                        >
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
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
                    className="text-sm text-gold-500 hover:text-gold-400"
                  >
                    New session
                  </Link>
                </div>
                <div className="space-y-3">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-charcoal-800/50 rounded-lg"
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
                            {session.date}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-charcoal-400">
                          {session.photos} photos
                        </p>
                        <Badge
                          variant={
                            session.status === "ready" ? "success" : "default"
                          }
                        >
                          {session.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
