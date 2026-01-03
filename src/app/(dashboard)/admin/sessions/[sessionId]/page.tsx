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
  Heart,
  Grid,
  List,
  Scan,
  X,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
// Thumbnails are now pre-generated - no transform needed
import { FaceDiscovery } from "@/components/faces";
import { confirmMatch, removeMatch } from "@/lib/actions/faces";

interface Photo {
  id: string;
  original_url: string;
  thumbnail_url: string;
  filename: string;
  created_at: string;
  likeCount?: number;
  likedBy?: Array<{ id: string; family_name: string; email?: string | null; phone?: string | null }>;
  matches: Array<{
    child_id: string;
    is_confirmed: boolean;
    child: {
      first_name: string;
      family: {
        family_name: string;
      } | null;
    } | null;
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
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [approvingMatch, setApprovingMatch] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  // Calculate unconfirmed matches count
  const unconfirmedMatches = photos.flatMap((p) =>
    p.matches?.filter((m) => !m.is_confirmed) || []
  );
  const unconfirmedCount = unconfirmedMatches.length;

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
          child_id,
          is_confirmed,
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
    const basePhotos = (photosData || []) as unknown as Photo[];

    // Hydrate favourites (hearts) so photographers can see what parents liked.
    const photoIds = basePhotos.map((p) => p.id);
    let likesByPhoto = new Map<
      string,
      { count: number; families: Array<{ id: string; family_name: string; email?: string | null; phone?: string | null }> }
    >();

    if (photoIds.length > 0) {
      const { data: likesData } = await supabase
        .from("photo_likes")
        .select("photo_id, family:families(id, family_name, email, phone)")
        .in("photo_id", photoIds);

      for (const row of (likesData || []) as any[]) {
        const photoId = row.photo_id as string;
        const family = Array.isArray(row.family) ? row.family?.[0] : row.family;
        const familyId = family?.id as string | undefined;
        const familyName = family?.family_name as string | undefined;
        const familyEmail = (family?.email as string | null | undefined) ?? null;
        const familyPhone = (family?.phone as string | null | undefined) ?? null;
        if (!photoId || !familyId || !familyName) continue;

        const prev = likesByPhoto.get(photoId) ?? { count: 0, families: [] };
        // de-dupe by family id
        if (!prev.families.some((f) => f.id === familyId)) {
          prev.families.push({
            id: familyId,
            family_name: familyName,
            email: familyEmail,
            phone: familyPhone,
          });
          prev.count += 1;
        }
        likesByPhoto.set(photoId, prev);
      }
    }

    setPhotos(
      basePhotos.map((p) => {
        const like = likesByPhoto.get(p.id);
        return {
          ...p,
          likeCount: like?.count ?? 0,
          likedBy: like?.families ?? [],
        };
      })
    );
    setLoading(false);
  }

  const handleApproveMatch = async (photoId: string, childId: string) => {
    const matchKey = `${photoId}-${childId}`;
    setApprovingMatch(matchKey);
    try {
      await confirmMatch(photoId, childId);
      // Update local state
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? {
                ...p,
                matches: p.matches.map((m) =>
                  m.child_id === childId ? { ...m, is_confirmed: true } : m
                ),
              }
            : p
        )
      );
      // Update selected photo if it's the one being modified
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto((prev) =>
          prev
            ? {
                ...prev,
                matches: prev.matches.map((m) =>
                  m.child_id === childId ? { ...m, is_confirmed: true } : m
                ),
              }
            : null
        );
      }
    } catch (error) {
      console.error("Failed to approve match:", error);
    } finally {
      setApprovingMatch(null);
    }
  };

  const handleRejectMatch = async (photoId: string, childId: string) => {
    const matchKey = `${photoId}-${childId}`;
    setApprovingMatch(matchKey);
    try {
      await removeMatch(photoId, childId);
      // Update local state
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? {
                ...p,
                matches: p.matches.filter((m) => m.child_id !== childId),
              }
            : p
        )
      );
      // Update selected photo if it's the one being modified
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto((prev) =>
          prev
            ? {
                ...prev,
                matches: prev.matches.filter((m) => m.child_id !== childId),
              }
            : null
        );
      }
    } catch (error) {
      console.error("Failed to reject match:", error);
    } finally {
      setApprovingMatch(null);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      // Get all unconfirmed matches
      const toApprove: Array<{ photoId: string; childId: string }> = [];
      photos.forEach((photo) => {
        photo.matches?.forEach((match) => {
          if (!match.is_confirmed) {
            toApprove.push({ photoId: photo.id, childId: match.child_id });
          }
        });
      });

      // Approve all
      await Promise.all(
        toApprove.map(({ photoId, childId }) => confirmMatch(photoId, childId))
      );

      // Update local state
      setPhotos((prev) =>
        prev.map((p) => ({
          ...p,
          matches: p.matches.map((m) => ({ ...m, is_confirmed: true })),
        }))
      );
    } catch (error) {
      console.error("Failed to approve all matches:", error);
    } finally {
      setApprovingAll(false);
    }
  };

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

              {/* Accept All button - only show if there are unconfirmed matches */}
              {unconfirmedCount > 0 && (
                <Button
                  variant="primary"
                  onClick={handleApproveAll}
                  disabled={approvingAll}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approvingAll ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Accept All ({unconfirmedCount})
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={() => setShowDiscovery(!showDiscovery)}
              >
                <Scan className="w-4 h-4 mr-2" />
                Discover Faces
              </Button>

              <Link href={`/admin/upload?session=${sessionId}`}>
                <Button variant="primary">
                  <Upload className="w-4 h-4 mr-2" />
                  Add Photos
                </Button>
              </Link>
            </div>
          </div>

          {/* Face Discovery */}
          {showDiscovery && (
            <div className="mb-6">
              <FaceDiscovery
                sessionId={sessionId}
                photos={photos.map((p) => ({
                  id: p.id,
                  url: p.original_url,
                }))}
                onComplete={(count) => {
                  setShowDiscovery(false);
                  // Optionally show success message or navigate
                }}
              />
            </div>
          )}

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
                          src={photo.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Unconfirmed matches overlay */}
                      {photo.matches?.some((m) => !m.is_confirmed) && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col justify-between p-2">
                          {/* Match buttons at top */}
                          <div className="flex flex-wrap gap-1">
                            {photo.matches
                              .filter((m) => !m.is_confirmed)
                              .map((match) => (
                                <div
                                  key={match.child_id}
                                  className="flex items-center gap-0.5 bg-gold-500 text-black rounded-full text-xs font-medium"
                                >
                                  <button
                                    className="pl-2 py-1 hover:bg-gold-400 rounded-l-full transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveMatch(photo.id, match.child_id);
                                    }}
                                    disabled={approvingMatch === `${photo.id}-${match.child_id}`}
                                    title="Approve match"
                                  >
                                    {approvingMatch === `${photo.id}-${match.child_id}` ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      match.child?.first_name || "Unknown"
                                    )}
                                  </button>
                                  <button
                                    className="px-1 py-1 hover:bg-red-500 hover:text-white rounded-r-full transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRejectMatch(photo.id, match.child_id);
                                    }}
                                    disabled={approvingMatch === `${photo.id}-${match.child_id}`}
                                    title="Remove match"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                          </div>
                          {/* Delete button at bottom (only on hover) */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 bg-black/50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePhoto(photo.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Confirmed matches indicator (small badge) */}
                      {photo.matches?.length > 0 &&
                        photo.matches.every((m) => m.is_confirmed) && (
                          <div className="absolute top-2 left-2">
                            <Badge variant="success" className="text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {photo.matches.length}
                            </Badge>
                          </div>
                        )}

                      {/* Likes (hearts) indicator */}
                      {(photo.likeCount || 0) > 0 && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="default" className="text-xs bg-black/60 border border-charcoal-700">
                            <Heart className="w-3 h-3 mr-1 text-red-400 fill-current" />
                            {photo.likeCount}
                          </Badge>
                        </div>
                      )}

                      {/* Hover overlay for photos without unconfirmed matches */}
                      {(!photo.matches?.some((m) => !m.is_confirmed)) && (
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
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Detail Panel */}
              <div className="lg:col-span-1">
                {selectedPhoto ? (
                  <Card variant="glass" className="p-4 sticky top-24">
                    <img
                      src={selectedPhoto.thumbnail_url}
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
                                {match.child?.first_name}{" "}
                                {match.child?.family?.family_name}
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

                    {(selectedPhoto.likeCount || 0) > 0 && (
                      <div className="mt-4 pt-4 border-t border-charcoal-800">
                        <p className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-400 fill-current" />
                          Favourites ({selectedPhoto.likeCount})
                        </p>
                        <div className="space-y-1">
                          {(selectedPhoto.likedBy || []).map((f) => (
                            <div key={f.id} className="text-sm text-charcoal-300">
                              <div className="text-charcoal-200">{f.family_name}</div>
                              {f.phone && (
                                <div className="text-xs text-charcoal-400">
                                  WhatsApp: {f.phone}
                                </div>
                              )}
                              {f.email && (
                                <div className="text-xs text-charcoal-500">{f.email}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
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
