"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Camera,
  Users,
  Calendar,
  ChevronRight,
  Loader2,
  Copy,
  Check,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Input, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

interface Family {
  id: string;
  family_name: string;
  access_code: string;
  children: Array<{ id: string; first_name: string }>;
}

interface Session {
  id: string;
  name: string;
  shoot_date: string;
  total_photos: number;
}

export default function TeacherDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      // Fetch families with children
      const { data: familiesData } = await supabase
        .from("families")
        .select(
          `
          id,
          family_name,
          access_code,
          children (
            id,
            first_name
          )
        `
        )
        .order("family_name");

      // Fetch recent sessions
      const { data: sessionsData } = await supabase
        .from("photo_sessions")
        .select("id, name, shoot_date, total_photos")
        .order("shoot_date", { ascending: false })
        .limit(3);

      setFamilies(familiesData || []);
      setSessions(sessionsData || []);
      setLoading(false);
    }

    fetchData();
  }, []);

  const filteredFamilies = families.filter(
    (family) =>
      family.family_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      family.children?.some((child) =>
        child.first_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const copyGalleryLink = async (family: Family, sessionId: string) => {
    const link = `${window.location.origin}/gallery/${sessionId}/${family.access_code}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(family.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
        </main>
      </div>
    );
  }

  // Get the most recent session for gallery links
  const latestSession = sessions[0];

  return (
    <div className="flex min-h-screen">
      <Sidebar role="teacher" />

      <main className="flex-1 ml-64">
        <Header
          title="Teacher Dashboard"
          subtitle="Find and browse family photos"
        />

        <div className="p-6 space-y-8">
          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-500" />
              <Input
                placeholder="Search by family name or child..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 py-4 text-lg bg-charcoal-900 border-charcoal-700"
              />
            </div>
          </motion.div>

          {/* Recent Sessions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gold-500" />
                Recent Sessions
              </h2>
              <Link
                href="/admin/upload"
                className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-black rounded-lg font-medium text-sm transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Photos
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sessions.length === 0 ? (
                <Link
                  href="/admin/upload"
                  className="col-span-3 border-2 border-dashed border-charcoal-700 rounded-xl p-8 flex flex-col items-center justify-center hover:border-gold-500/50 transition-colors"
                >
                  <Camera className="w-8 h-8 text-charcoal-500 mb-2" />
                  <p className="text-charcoal-400">
                    No sessions yet. Click to upload photos.
                  </p>
                </Link>
              ) : (
                sessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link href={`/admin/upload?session=${session.id}`}>
                      <Card
                        variant="glass"
                        className="cursor-pointer hover:border-gold-500/30 transition-all"
                      >
                        <CardContent className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">
                              {session.name}
                            </p>
                            <p className="text-sm text-charcoal-400">
                              {formatDate(session.shoot_date)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-charcoal-400">
                            <Camera className="w-4 h-4" />
                            <span>{session.total_photos}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </section>

          {/* Families List */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-400" />
              Families ({filteredFamilies.length})
            </h2>
            <div className="space-y-2">
              {filteredFamilies.length === 0 && !searchQuery ? (
                <p className="text-charcoal-500">
                  No families registered yet.
                </p>
              ) : (
                filteredFamilies.map((family, index) => (
                  <motion.div
                    key={family.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      variant="default"
                      className="hover:bg-charcoal-800 transition-all group p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-serif text-lg">
                            {family.family_name[0]}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">
                                {family.family_name}
                              </p>
                              <Badge variant="default" className="text-xs">
                                {family.access_code}
                              </Badge>
                            </div>
                            <p className="text-sm text-charcoal-400">
                              {family.children?.map((c) => c.first_name).join(", ") ||
                                "No children registered"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Copy gallery link button */}
                          {latestSession && (
                            <button
                              onClick={() =>
                                copyGalleryLink(family, latestSession.id)
                              }
                              className="p-2 rounded-lg hover:bg-charcoal-700 transition-colors text-charcoal-400 hover:text-white"
                              title="Copy gallery link"
                            >
                              {copiedId === family.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* View gallery link */}
                          {latestSession && (
                            <Link
                              href={`/gallery/${latestSession.id}/${family.access_code}`}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-700 hover:bg-charcoal-600 transition-colors text-white text-sm"
                            >
                              View Gallery
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}

              {filteredFamilies.length === 0 && searchQuery && (
                <div className="text-center py-12">
                  <p className="text-charcoal-500">
                    No families found matching &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
