"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  User,
  Camera,
  CheckCircle,
  Upload,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { removeMatch, restoreMatchesForPhoto } from "@/lib/actions/faces";

interface Child {
  id: string;
  first_name: string;
  date_of_birth: string | null;
  reference_photo_url: string | null;
}

interface Family {
  id: string;
  family_name: string;
  access_code: string;
  email: string;
  children: Child[];
}

type FamilyPhotoMatchRow = {
  photo_id: string;
  child_id: string;
  is_confirmed: boolean;
  photo?: {
    id: string;
    original_url: string;
    thumbnail_url: string | null;
    session_id: string;
    session?: {
      id: string;
      name: string;
      shoot_date: string;
    };
  };
  child?: {
    id: string;
    first_name: string;
  };
  // Back-compat with older PostgREST embed shapes (arrays)
  photos?: Array<FamilyPhotoMatchRow["photo"]>;
  children?: Array<FamilyPhotoMatchRow["child"]>;
};

type FamilyPhoto = {
  photoId: string;
  originalUrl: string;
  thumbnailUrl: string;
  sessionId: string;
  sessionName: string;
  sessionDate: string | null;
  children: Array<{ id: string; firstName: string; isConfirmed: boolean }>;
  confirmedCount: number;
  totalCount: number;
};

export default function FamilyDetailPage() {
  const params = useParams();
  const familyId = params.familyId as string;
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollingChildId, setEnrollingChildId] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [familyPhotos, setFamilyPhotos] = useState<FamilyPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [photoFilter, setPhotoFilter] = useState<"all" | "confirmed" | "unconfirmed">("all");
  const [pendingRemovePhotoId, setPendingRemovePhotoId] = useState<string | null>(null);
  const [undoItem, setUndoItem] = useState<FamilyPhoto | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFamily() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("families")
        .select(`
          id,
          family_name,
          access_code,
          email,
          children (
            id,
            first_name,
            date_of_birth,
            is_enrolled,
            reference_photo_url
          )
        `)
        .eq("id", familyId)
        .single();

      if (error) {
        console.error("Error fetching family:", error);
      } else {
        setFamily(data as Family);
      }
      setLoading(false);
    }

    fetchFamily();
  }, [familyId]);

  const fetchFamilyPhotos = useCallback(async () => {
    if (!family) return;
    if (!family.children?.length) return;

    setPhotosLoading(true);
    setPhotosError(null);
    try {
      const supabase = createClient();
      const childIds = family.children.map((c) => c.id);

      const { data, error } = await supabase
        .from("photo_children")
        .select(
          `
          photo_id,
          child_id,
          is_confirmed,
          photo:photos!inner (
            id,
            original_url,
            thumbnail_url,
            session_id,
            session:photo_sessions (
              id,
              name,
              shoot_date
            )
          ),
          child:children (
            id,
            first_name
          )
        `
        )
        .in("child_id", childIds);

      if (error) throw error;

      const rows = (data || []) as unknown as FamilyPhotoMatchRow[];

      const byPhoto = new Map<string, FamilyPhoto>();
      for (const r of rows) {
        const photo =
          (r as any).photo ??
          (Array.isArray((r as any).photos) ? (r as any).photos?.[0] : (r as any).photos);
        if (!photo) continue;
        const session =
          (photo as any).session ??
          (Array.isArray((photo as any).photo_sessions)
            ? (photo as any).photo_sessions?.[0]
            : (photo as any).photo_sessions);

        const existing =
          byPhoto.get(r.photo_id) ??
          ({
            photoId: r.photo_id,
            originalUrl: photo.original_url,
            thumbnailUrl: photo.thumbnail_url || photo.original_url,
            sessionId: photo.session_id,
            sessionName: session?.name || "Session",
            sessionDate: session?.shoot_date || null,
            children: [],
            confirmedCount: 0,
            totalCount: 0,
          } as FamilyPhoto);

        const child =
          (r as any).child ??
          (Array.isArray((r as any).children) ? (r as any).children?.[0] : (r as any).children);
        if (child) {
          // Dedup child entries
          const already = existing.children.some((c) => c.id === child.id);
          if (!already) {
            existing.children.push({
              id: child.id,
              firstName: child.first_name,
              isConfirmed: r.is_confirmed === true,
            });
          }
        }

        existing.totalCount = existing.children.length;
        existing.confirmedCount = existing.children.filter((c) => c.isConfirmed).length;

        byPhoto.set(r.photo_id, existing);
      }

      // Sort newest sessions first, then stable by photoId
      const sorted = Array.from(byPhoto.values()).sort((a, b) => {
        const ad = a.sessionDate ? new Date(a.sessionDate).getTime() : 0;
        const bd = b.sessionDate ? new Date(b.sessionDate).getTime() : 0;
        if (bd !== ad) return bd - ad;
        return a.photoId.localeCompare(b.photoId);
      });

      setFamilyPhotos(sorted);
    } catch (e) {
      console.error("Error fetching family photos:", e);
      setPhotosError("Failed to load matched photos for this family.");
      setFamilyPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  }, [family]);

  useEffect(() => {
    fetchFamilyPhotos().catch(() => {});
  }, [fetchFamilyPhotos]);

  const handleRemovePhoto = async (photo: FamilyPhoto) => {
    if (pendingRemovePhotoId) return;

    setPendingRemovePhotoId(photo.photoId);
    setUndoError(null);

    // Optimistically remove from UI + prepare undo
    const snapshot = photo;
    setUndoItem(snapshot);
    setFamilyPhotos((prev) => prev.filter((p) => p.photoId !== photo.photoId));

    try {
      // Remove ALL matches for this photo for this family (all children shown on the tile)
      await Promise.all(snapshot.children.map((c) => removeMatch(snapshot.photoId, c.id)));
    } catch (e) {
      console.error("Failed to remove photo matches:", e);
      setUndoError("Failed to remove. Reload and try again.");
      // Restore UI on failure
      setFamilyPhotos((prev) => {
        const next = [...prev, snapshot];
        return next.sort((a, b) => {
          const ad = a.sessionDate ? new Date(a.sessionDate).getTime() : 0;
          const bd = b.sessionDate ? new Date(b.sessionDate).getTime() : 0;
          if (bd !== ad) return bd - ad;
          return a.photoId.localeCompare(b.photoId);
        });
      });
      setUndoItem(null);
    } finally {
      setPendingRemovePhotoId(null);
    }
  };

  const handleUndoRemove = async () => {
    if (!undoItem) return;
    const snapshot = undoItem;

    setUndoError(null);
    try {
      await restoreMatchesForPhoto(
        snapshot.photoId,
        snapshot.children.map((c) => ({
          childId: c.id,
          isConfirmed: c.isConfirmed,
          confidence: 1.0,
        }))
      );
      setUndoItem(null);
      await fetchFamilyPhotos();
    } catch (e) {
      console.error("Failed to undo remove:", e);
      setUndoError("Failed to undo. Please refresh and try again.");
    }
  };

  const handleEnrollClick = (childId: string) => {
    setEnrollingChildId(childId);
    setEnrollError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !enrollingChildId) return;

    try {
      // 1. Upload photo to Supabase storage
      const supabase = createClient();
      const filename = `${enrollingChildId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("reference-photos")
        .upload(filename, file);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("reference-photos")
        .getPublicUrl(filename);

      const photoUrl = urlData.publicUrl;

      // 3. Save reference photo URL (face embeddings are generated server-side by the InsightFace worker)
      const { error: updateError } = await supabase
        .from("children")
        .update({
          reference_photo_url: photoUrl,
        })
        .eq("id", enrollingChildId);

      if (updateError) throw updateError;

      // 4. Refresh family data
      const { data } = await supabase
        .from("families")
        .select(`
          id,
          family_name,
          access_code,
          email,
          children (
            id,
            first_name,
            date_of_birth,
            reference_photo_url
          )
        `)
        .eq("id", familyId)
        .single();

      if (data) {
        setFamily(data as Family);
      }
    } catch (error) {
      console.error("Enrollment failed:", error);
      setEnrollError("Failed to enroll child. Please try again.");
    } finally {
      setEnrollingChildId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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

  if (!family) {
    return (
      <div className="flex min-h-screen">
        <Sidebar role="admin" />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-charcoal-400">Family not found</p>
        </main>
      </div>
    );
  }

  const withReferencePhotoCount = family.children.filter((c) => !!c.reference_photo_url).length;
  const confirmedPhotosCount = familyPhotos.filter((p) => p.confirmedCount > 0).length;

  const visiblePhotos = familyPhotos.filter((p) => {
    if (photoFilter === "all") return true;
    if (photoFilter === "confirmed") return p.confirmedCount > 0;
    return p.confirmedCount === 0;
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />

      <main className="flex-1 ml-64">
        <Header
          title={family.family_name}
          subtitle={`Access code: ${family.access_code}`}
        />

        <div className="p-6 space-y-6">
          {/* Back link */}
          <Link
            href="/admin/families"
            className="inline-flex items-center gap-2 text-charcoal-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Families
          </Link>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-charcoal-300">
              <User className="w-4 h-4" />
              <span>{family.children.length} children</span>
            </div>
            <div className="flex items-center gap-2 text-charcoal-300">
              <Camera className="w-4 h-4" />
              <span>{withReferencePhotoCount} with reference photos</span>
            </div>
          </div>

          {/* Error message */}
          {enrollError && (
            <Card variant="glass" className="border-red-500/30 bg-red-500/10">
              <CardContent className="flex items-center gap-3 py-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400">{enrollError}</p>
                <button
                  onClick={() => setEnrollError(null)}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          )}

          {/* Children Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {family.children.map((child) => (
              <Card key={child.id} variant="glass" className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Reference Photo */}
                  <div className="aspect-square bg-charcoal-800 relative">
                    {child.reference_photo_url ? (
                      <Image
                        src={child.reference_photo_url}
                        alt={child.first_name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <User className="w-16 h-16 text-charcoal-600" />
                      </div>
                    )}

                    {/* Reference photo badge */}
                    {child.reference_photo_url && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Ready
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Child Info */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-medium text-white text-lg">
                        {child.first_name}
                      </h3>
                      {child.date_of_birth && (
                        <p className="text-sm text-charcoal-400">
                          Born {new Date(child.date_of_birth).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Enroll button */}
                    <Button
                      variant={child.reference_photo_url ? "ghost" : "primary"}
                      size="sm"
                      className="w-full"
                      onClick={() => handleEnrollClick(child.id)}
                      disabled={enrollingChildId === child.id}
                    >
                      {enrollingChildId === child.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : child.reference_photo_url ? (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          Update Photo
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Reference Photo
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Matched Photos (for verification) */}
          <Card variant="glass">
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-white">Matched Photos</h3>
                  <p className="text-sm text-charcoal-400">
                    {familyPhotos.length} total photos matched • {confirmedPhotosCount} have at least one confirmed child
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={photoFilter === "all" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setPhotoFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={photoFilter === "confirmed" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setPhotoFilter("confirmed")}
                  >
                    Confirmed
                  </Button>
                  <Button
                    variant={photoFilter === "unconfirmed" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setPhotoFilter("unconfirmed")}
                  >
                    Unconfirmed
                  </Button>
                </div>
              </div>

              {photosError && (
                <div className="text-sm text-red-300">{photosError}</div>
              )}

              {photosLoading ? (
                <div className="flex items-center gap-3 text-charcoal-400">
                  <Loader2 className="w-5 h-5 animate-spin text-gold-500" />
                  Loading matched photos...
                </div>
              ) : visiblePhotos.length === 0 ? (
                <div className="text-sm text-charcoal-400">
                  No matched photos found for this family{photoFilter !== "all" ? " with this filter" : ""}.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {visiblePhotos.slice(0, 120).map((p) => (
                    <a
                      key={p.photoId}
                      href={p.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group block"
                      title={`${p.sessionName} • ${p.totalCount} matches`}
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden border border-charcoal-700 group-hover:border-charcoal-500 transition-colors">
                        <img
                          src={p.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemovePhoto(p).catch(() => {});
                          }}
                          disabled={pendingRemovePhotoId === p.photoId}
                          className="absolute top-2 left-2 px-2 py-1 text-xs rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors disabled:opacity-60"
                          title="Remove this photo from this family (undo available)"
                        >
                          {pendingRemovePhotoId === p.photoId ? "Removing..." : "Remove"}
                        </button>
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-white truncate">
                              {p.sessionName}
                            </span>
                            <Badge variant={p.confirmedCount > 0 ? "success" : "warning"} className="text-xs">
                              {p.confirmedCount}/{p.totalCount}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.children.slice(0, 3).map((c) => (
                          <span
                            key={c.id}
                            className={`text-[11px] px-1.5 py-0.5 rounded ${
                              c.isConfirmed ? "bg-teal-500/20 text-teal-300" : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {c.firstName}
                          </span>
                        ))}
                        {p.children.length > 3 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-charcoal-800 text-charcoal-400">
                            +{p.children.length - 3}
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {familyPhotos.length > 120 && (
                <p className="text-xs text-charcoal-500">
                  Showing first 120 photos. (We can add pagination if you want.)
                </p>
              )}

              {undoItem && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <div className="text-sm text-amber-200">
                    Removed 1 photo from this family. Undo?
                    {undoError && (
                      <span className="block text-xs text-red-300 mt-1">{undoError}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setUndoItem(null)}>
                      Dismiss
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleUndoRemove().catch(() => {})}>
                      Undo
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Instructions */}
          <Card variant="glass">
            <CardContent>
              <h3 className="font-medium text-white mb-2">How Matching Works Now</h3>
              <ol className="text-sm text-charcoal-400 space-y-2 list-decimal list-inside">
                <li>Upload session photos</li>
                <li>Run server-side face discovery (InsightFace worker) to cluster faces</li>
                <li>Go to Admin → Faces to label each cluster</li>
                <li>Parents will see only confirmed photos after clusters are labeled</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
