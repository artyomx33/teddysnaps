"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Users,
  Calendar,
  Loader2,
  Trash2,
  Upload,
  Brain,
  CheckCircle,
  Grid,
  List,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { imagePresets } from "@/lib/image-transform";

interface Photo {
  id: string;
  original_url: string;
  thumbnail_url: string;
  filename: string;
  created_at: string;
  matches: Array<{
    child: Array<{
      first_name: string;
      family: Array<{
        family_name: string;
      }>;
    }>;
    confidence: number;
  }>;
}

interface Session {
  id: string;
  name: string;
  shoot_date: string;
  status: string;
  total_photos: number;
  location: Array<{
    name: string;
  }>;
}

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  async function fetchData() {
    const supabase = createClient();

    // Fetch session details
    const { data: sessionData } = await supabase
      .from("photo_sessions")
      .select(`
        id,
        name,
        shoot_date,
        status,
        total_photos,
        location:locations (name)
      `)
      .eq("id", sessionId)
      .single();

    // Fetch photos with matches
    const { data: photosData } = await supabase
      .from("photos")
      .select(`
        id,
        original_url,
        thumbnail_url,
        filename,
        created_at,
        matches:photo_children (
          confidence,
          child:children (
            first_name,
            family:families (family_name)
          )
        )
      `)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    setSession(sessionData);
    setPhotos(photosData || []);
    setLoading(false);
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;

    const supabase = createClient();

    // Delete matches first
    await supabase.from("photo_children").delete().eq("photo_id", photoId);

    // Delete photo
    await supabase.from("photos").delete().eq("id", photoId);

    // Update local state
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    if (selectedPhoto?.id === photoId) setSelectedPhoto(null);
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
      <div className="flex min-h-screen">
        <Sidebar role="admin" />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen">
        <Sidebar role="admin" />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Card variant="glass" className="p-8 text-center">
            <p className="text-charcoal-400">Session not found</p>
            <Link href="/admin">
              <Button variant="primary" className="mt-4">
                Back to Dashboard
              </Button>
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />

      <main className="flex-1 ml-64">
        <Header
          title={session.name}
          subtitle={`${session.location?.[0]?.name || "Unknown location"} • ${formatDate(session.shoot_date)}`}
        />

        <div className="p-6">
          {/* Stats Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-6">
              <Link
                href="/admin"
                className="flex items-center gap-2 text-charcoal-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>

              <div className="flex items-center gap-2 text-charcoal-300">
                <Camera className="w-4 h-4" />
                <span>{photos.length} photos</span>
              </div>

              <Badge
                variant={session.status === "ready" ? "success" : "default"}
              >
                {session.status}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-charcoal-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    viewMode === "grid"
                      ? "bg-charcoal-700 text-white"
                      : "text-charcoal-400 hover:text-white"
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    viewMode === "list"
                      ? "bg-charcoal-700 text-white"
                      : "text-charcoal-400 hover:text-white"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <Link href={`/admin/upload?session=${sessionId}`}>
                <Button variant="primary">
                  <Upload className="w-4 h-4 mr-2" />
                  Add Photos
                </Button>
              </Link>
            </div>
          </div>

          {photos.length === 0 ? (
            <Card variant="glass" className="p-12 text-center">
              <Camera className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
              <p className="text-charcoal-400 mb-4">No photos in this session yet</p>
              <Link href={`/admin/upload?session=${sessionId}`}>
                <Button variant="primary">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photos
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Photo Grid */}
              <div className="lg:col-span-3">
                <div
                  className={cn(
                    "grid gap-4",
                    viewMode === "grid"
                      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                      : "grid-cols-1"
                  )}
                >
                  {photos.map((photo, index) => (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                        selectedPhoto?.id === photo.id
                          ? "border-gold-500"
                          : "border-transparent hover:border-charcoal-600"
                      )}
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <div
                        className={cn(
                          viewMode === "grid" ? "aspect-square" : "aspect-video"
                        )}
                      >
                        <img
                          src={imagePresets.thumbnail(photo.thumbnail_url)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Match indicators */}
                      {photo.matches && photo.matches.length > 0 && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="success" className="text-xs">
                            <Users className="w-3 h-3 mr-1" />
                            {photo.matches.length}
                          </Badge>
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Detail Panel */}
              <div className="lg:col-span-1">
                {selectedPhoto ? (
                  <Card variant="glass" className="p-4 sticky top-24">
                    <img
                      src={imagePresets.preview(selectedPhoto.thumbnail_url)}
                      alt=""
                      className="w-full aspect-square object-cover rounded-lg mb-4"
                    />

                    <p className="text-sm text-charcoal-400 mb-2">
                      {selectedPhoto.filename}
                    </p>

                    {selectedPhoto.matches && selectedPhoto.matches.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-teal-400" />
                          Matched Children
                        </p>
                        <div className="space-y-2">
                          {selectedPhoto.matches.map((match, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-charcoal-300">
                                {match.child?.[0]?.first_name}{" "}
                                {match.child?.[0]?.family?.[0]?.family_name}
                              </span>
                              <Badge variant="default" className="text-xs">
                                {Math.round(match.confidence * 100)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-charcoal-500">
                        No children matched yet
                      </p>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-4 text-red-400"
                      onClick={() => handleDeletePhoto(selectedPhoto.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Photo
                    </Button>
                  </Card>
                ) : (
                  <Card variant="glass" className="p-6 text-center">
                    <Camera className="w-8 h-8 text-charcoal-500 mx-auto mb-2" />
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
