"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  Scan,
  ArrowLeft,
  Loader2,
  Check,
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { FaceNaming } from "@/components/faces";
import { createClient } from "@/lib/supabase/client";

interface Session {
  id: string;
  name: string;
  shoot_date: string;
  location_id: string;
  total_photos: number;
  location: { name: string }[];
}

function FacesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [faceStats, setFaceStats] = useState<Record<string, { total: number; unnamed: number }>>({});

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (sessionId && sessions.length > 0) {
      const session = sessions.find((s) => s.id === sessionId);
      setSelectedSession(session || null);
    }
  }, [sessionId, sessions]);

  async function fetchSessions() {
    const supabase = createClient();

    const { data: sessionsData } = await supabase
      .from("photo_sessions")
      .select(`
        id,
        name,
        shoot_date,
        location_id,
        total_photos,
        location:locations (name)
      `)
      .order("shoot_date", { ascending: false });

    setSessions(sessionsData || []);

    // Get face stats for each session
    const stats: Record<string, { total: number; unnamed: number }> = {};

    for (const session of sessionsData || []) {
      const { count: total } = await supabase
        .from("discovered_faces")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id);

      const { count: unnamed } = await supabase
        .from("discovered_faces")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("is_named", false)
        .eq("is_skipped", false);

      stats[session.id] = {
        total: total || 0,
        unnamed: unnamed || 0,
      };
    }

    setFaceStats(stats);
    setLoading(false);
  }

  const handleComplete = () => {
    fetchSessions();
    router.push("/admin/faces");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <main className="flex-1 ml-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex-1 ml-64">
      <Header
        title="Face Management"
        subtitle="Discover and name faces in your photos"
      />

      <div className="p-6">
        {selectedSession ? (
          <>
            {/* Back button */}
            <Link
              href="/admin/faces"
              className="flex items-center gap-2 text-charcoal-400 hover:text-white transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sessions
            </Link>

            {/* Session info */}
            <Card variant="glass" className="p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-white">
                    {selectedSession.name}
                  </h2>
                  <p className="text-sm text-charcoal-400">
                    {selectedSession.location?.[0]?.name} •{" "}
                    {formatDate(selectedSession.shoot_date)}
                  </p>
                </div>
                <Badge variant="default">
                  {faceStats[selectedSession.id]?.unnamed || 0} faces to name
                </Badge>
              </div>
            </Card>

            {/* Face Naming UI */}
            <FaceNaming
              sessionId={selectedSession.id}
              locationId={selectedSession.location_id}
              onComplete={handleComplete}
            />
          </>
        ) : (
          <>
            {/* Session list */}
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <Card variant="glass" className="p-12 text-center">
                  <Scan className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
                  <p className="text-charcoal-400">No sessions with photos yet</p>
                </Card>
              ) : (
                sessions.map((session, index) => {
                  const stats = faceStats[session.id] || { total: 0, unnamed: 0 };

                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        variant="default"
                        className="p-4 hover:bg-charcoal-800/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/faces?session=${session.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">
                              {session.name}
                            </p>
                            <p className="text-sm text-charcoal-400">
                              {session.location?.[0]?.name} •{" "}
                              {formatDate(session.shoot_date)} •{" "}
                              {session.total_photos} photos
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            {stats.total === 0 ? (
                              <Badge variant="default">
                                <Scan className="w-3 h-3 mr-1" />
                                No faces yet
                              </Badge>
                            ) : stats.unnamed === 0 ? (
                              <Badge variant="success">
                                <Check className="w-3 h-3 mr-1" />
                                All named
                              </Badge>
                            ) : (
                              <Badge variant="warning">
                                <Users className="w-3 h-3 mr-1" />
                                {stats.unnamed} to name
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function FacesPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />
      <Suspense fallback={
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
        </main>
      }>
        <FacesPageContent />
      </Suspense>
    </div>
  );
}
