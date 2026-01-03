"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Brush,
  Clock,
  CheckCircle,
  Loader2,
  Mail,
  Phone,
  Download,
  User,
  Calendar,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, Badge, Button, Glow } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
// Thumbnails are now pre-generated - no transform needed

type TaskStatus = "queued" | "assigned" | "editing" | "done" | "delivered";

interface RetouchTask {
  id: string;
  status: TaskStatus;
  notes: string | null;
  retouched_url: string | null;
  created_at: string;
  updated_at: string;
  photo: {
    id: string;
    thumbnail_url: string;
    original_url: string;
    filename: string;
  } | null;
  family: {
    id: string;
    family_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  session: {
    id: string;
    name: string;
    shoot_date: string;
  } | null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

const statusConfig: Record<TaskStatus, { color: string; icon: typeof Clock; label: string }> = {
  queued: { color: "bg-yellow-500/20 text-yellow-400", icon: Clock, label: "Queued" },
  assigned: { color: "bg-blue-500/20 text-blue-400", icon: User, label: "Assigned" },
  editing: { color: "bg-purple-500/20 text-purple-400", icon: Brush, label: "Editing" },
  done: { color: "bg-green-500/20 text-green-400", icon: CheckCircle, label: "Done" },
  delivered: { color: "bg-teal-500/20 text-teal-400", icon: Download, label: "Delivered" },
};

const statusOptions: TaskStatus[] = ["queued", "assigned", "editing", "done", "delivered"];

export default function RetouchQueuePage() {
  const [tasks, setTasks] = useState<RetouchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<RetouchTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("retouch_tasks")
      .select(`
        id,
        status,
        notes,
        retouched_url,
        created_at,
        updated_at,
        photo:photos (
          id,
          thumbnail_url,
          original_url,
          filename
        ),
        family:families (
          id,
          family_name,
          email,
          phone
        ),
        session:photo_sessions (
          id,
          name,
          shoot_date
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching retouch tasks:", error);
    } else {
      const normalized: RetouchTask[] = (data || []).map((row) => {
        const r = row as unknown as Record<string, unknown>;
        return {
          ...(r as unknown as RetouchTask),
          photo: pickOne(r.photo as unknown) as RetouchTask["photo"],
          family: pickOne(r.family as unknown) as RetouchTask["family"],
          session: pickOne(r.session as unknown) as RetouchTask["session"],
        };
      });
      setTasks(normalized);
    }
    setLoading(false);
  }

  async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    setUpdatingStatus(true);
    const supabase = createClient();

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "done") {
      updates.done_at = new Date().toISOString();
    } else if (newStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
    } else if (newStatus === "assigned") {
      updates.assigned_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("retouch_tasks")
      .update(updates)
      .eq("id", taskId);

    if (!error) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, updated_at: updates.updated_at as string } : t
        )
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    }
    setUpdatingStatus(false);
  }

  const filteredTasks = statusFilter === "all"
    ? tasks
    : tasks.filter((t) => t.status === statusFilter);

  const statusCounts = statusOptions.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
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
        <Header
          title="Retouch Queue"
          subtitle={`${statusCounts.queued} photos waiting for editing`}
        />

        <div className="p-6">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                statusFilter === "all"
                  ? "bg-gold-500 text-black"
                  : "bg-charcoal-800 text-charcoal-400 hover:text-white"
              )}
            >
              All ({tasks.length})
            </button>
            {statusOptions.map((status) => {
              const config = statusConfig[status];
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2",
                    statusFilter === status
                      ? "bg-gold-500 text-black"
                      : "bg-charcoal-800 text-charcoal-400 hover:text-white"
                  )}
                >
                  <config.icon className="w-4 h-4" />
                  {config.label} ({statusCounts[status]})
                </button>
              );
            })}
          </div>

          {filteredTasks.length === 0 ? (
            <Card variant="glass" className="p-12 text-center">
              <Brush className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
              <p className="text-charcoal-400">
                {statusFilter === "all"
                  ? "No retouch tasks yet"
                  : `No ${statusFilter} tasks`}
              </p>
              <p className="text-sm text-charcoal-500 mt-2">
                Tasks appear here when families purchase photos
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Photo Grid */}
              <div className="lg:col-span-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredTasks.map((task, index) => {
                    const StatusIcon = statusConfig[task.status]?.icon || Clock;
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <Glow variant="gold" className="rounded-xl">
                          <div
                            className={cn(
                              "relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all",
                              selectedTask?.id === task.id
                                ? "border-gold-500"
                                : "border-transparent hover:border-charcoal-600"
                            )}
                            onClick={() => setSelectedTask(task)}
                          >
                            <div className="aspect-square bg-charcoal-800">
                              {task.photo?.thumbnail_url && (
                                <img
                                  src={task.photo.thumbnail_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>

                            {/* HD Badge */}
                            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-gold-500 text-black text-xs font-bold flex items-center gap-1">
                              <Download className="w-3 h-3" />
                              HD
                            </div>

                            {/* Status Badge */}
                            <div className="absolute top-2 right-2">
                              <Badge className={cn("text-xs", statusConfig[task.status]?.color)}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig[task.status]?.label}
                              </Badge>
                            </div>

                            {/* Family Info */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                              <p className="text-white text-sm font-medium truncate">
                                {task.family?.family_name || "Unknown"}
                              </p>
                              <p className="text-charcoal-400 text-xs truncate">
                                {task.session?.name || "Unknown session"}
                              </p>
                            </div>
                          </div>
                        </Glow>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Detail Panel */}
              <div className="lg:col-span-1">
                {selectedTask ? (
                  <Card variant="glass" className="p-4 sticky top-24">
                    {/* Preview */}
                    <div className="aspect-square rounded-lg overflow-hidden bg-charcoal-800 mb-4">
                      {selectedTask.photo?.thumbnail_url && (
                        <img
                          src={selectedTask.photo.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* HD Badge */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="px-3 py-1.5 rounded-lg bg-gold-500 text-black text-sm font-bold flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        HD Photo
                      </div>
                      <Badge className={cn("text-xs", statusConfig[selectedTask.status]?.color)}>
                        {statusConfig[selectedTask.status]?.label}
                      </Badge>
                    </div>

                    {/* Family Info */}
                    <div className="space-y-3 mb-4">
                      <div>
                        <p className="text-sm text-charcoal-400">Family</p>
                        <p className="text-white font-medium">
                          {selectedTask.family?.family_name || "Unknown"}
                        </p>
                      </div>

                      {selectedTask.family?.email && (
                        <div className="flex items-center gap-2 text-charcoal-300">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">{selectedTask.family.email}</span>
                        </div>
                      )}

                      {selectedTask.family?.phone && (
                        <div className="flex items-center gap-2 text-charcoal-300">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">{selectedTask.family.phone}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-charcoal-300">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">
                          {selectedTask.session?.name} ({selectedTask.session?.shoot_date ? formatDate(selectedTask.session.shoot_date) : "N/A"})
                        </span>
                      </div>
                    </div>

                    <hr className="border-charcoal-700 my-4" />

                    {/* Status Update */}
                    <div className="mb-4">
                      <p className="text-sm text-charcoal-400 mb-2">Update Status</p>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            onClick={() => updateTaskStatus(selectedTask.id, status)}
                            disabled={updatingStatus || selectedTask.status === status}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              selectedTask.status === status
                                ? statusConfig[status].color + " ring-2 ring-white/20"
                                : "bg-charcoal-800 text-charcoal-400 hover:text-white"
                            )}
                          >
                            {statusConfig[status].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Download Original */}
                    {selectedTask.photo?.original_url && (
                      <a
                        href={selectedTask.photo.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        <Button variant="primary" className="w-full mb-3">
                          <Download className="w-4 h-4 mr-2" />
                          Download Original
                        </Button>
                      </a>
                    )}

                    {/* Notes */}
                    {selectedTask.notes && (
                      <div className="mt-4 p-3 bg-charcoal-800 rounded-lg">
                        <p className="text-sm text-charcoal-400 mb-1">Notes</p>
                        <p className="text-sm text-white">{selectedTask.notes}</p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="mt-4 text-xs text-charcoal-500 space-y-1">
                      <p>Created: {formatDate(selectedTask.created_at)}</p>
                      <p>Updated: {formatDate(selectedTask.updated_at)}</p>
                    </div>
                  </Card>
                ) : (
                  <Card variant="glass" className="p-6 text-center">
                    <Brush className="w-8 h-8 text-charcoal-500 mx-auto mb-2" />
                    <p className="text-charcoal-400 text-sm">
                      Select a photo to view details
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
