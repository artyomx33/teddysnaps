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
  Star,
  Mail,
  MessageCircle,
  Sparkles,
  Trash2,
  ImagePlus,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge, Glow } from "@/components/ui";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { removeMatch, restoreMatchesForPhoto } from "@/lib/actions/faces";
import { setFamilyHeroPhoto } from "@/lib/actions/families";
// Thumbnails are now pre-generated - no transform needed

interface Child {
  id: string;
  first_name: string;
  date_of_birth: string | null;
  reference_photo_url: string | null;
}

interface HeroPhoto {
  id: string;
  thumbnail_url: string | null;
  original_url: string;
}

interface Family {
  id: string;
  family_name: string;
  access_code: string;
  email: string | null;
  phone: string | null;
  hero_photo_id: string | null;
  hero_photo?: HeroPhoto[];
  children: Child[];
}

type FamilyPhotoMatchRow = {
  photo_id: string;
  child_id: string;
  is_confirmed: boolean;
  photo?: PhotoEmbed | PhotoEmbed[];
  child?: ChildEmbed | ChildEmbed[];
  // Back-compat with older PostgREST embed shapes
  photos?: PhotoEmbed | PhotoEmbed[];
  children?: ChildEmbed | ChildEmbed[];
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

type SessionEmbed = {
  id: string;
  name: string;
  shoot_date: string;
};

type PhotoEmbed = {
  id: string;
  original_url: string;
  thumbnail_url: string | null;
  session_id: string;
  session?: SessionEmbed | SessionEmbed[];
  // Back-compat
  photo_sessions?: SessionEmbed | SessionEmbed[];
};

type ChildEmbed = {
  id: string;
  first_name: string;
};

function firstOf<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export default function FamilyDetailPage() {
  const params = useParams();
  const familyId = params.familyId as string;
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollingChildId, setEnrollingChildId] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const retouchFileInputRef = useRef<HTMLInputElement>(null);

  const [familyPhotos, setFamilyPhotos] = useState<FamilyPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [photoFilter, setPhotoFilter] = useState<"all" | "confirmed" | "unconfirmed">("all");
  const [pendingRemovePhotoId, setPendingRemovePhotoId] = useState<string | null>(null);
  const [undoItem, setUndoItem] = useState<FamilyPhoto | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [settingHeroPhotoId, setSettingHeroPhotoId] = useState<string | null>(null);

  const [paidOrdersCount, setPaidOrdersCount] = useState(0);
  const [purchasedPhotoIds, setPurchasedPhotoIds] = useState<Set<string>>(new Set());
  const [retouchByPhotoId, setRetouchByPhotoId] = useState<
    Record<string, { status: string; retouchedUrl: string | null }>
  >({});
  const [openRetouchCount, setOpenRetouchCount] = useState(0);
  const [retouchUploadPhotoId, setRetouchUploadPhotoId] = useState<string | null>(null);
  const [retouchUploadingPhotoId, setRetouchUploadingPhotoId] = useState<string | null>(null);
  const [retouchUploadError, setRetouchUploadError] = useState<string | null>(null);

  // Retouched photos section state
  interface RetouchedPhoto {
    id: string;
    original_url: string;
    thumbnail_url: string | null;
    filename: string | null;
    created_at: string;
  }
  const [retouchedPhotos, setRetouchedPhotos] = useState<RetouchedPhoto[]>([]);
  const [retouchedLoading, setRetouchedLoading] = useState(false);
  const [uploadingRetouched, setUploadingRetouched] = useState(false);
  const [retouchedUploadError, setRetouchedUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const retouchedFileInputRef = useRef<HTMLInputElement>(null);

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
          phone,
          hero_photo_id,
          hero_photo:photos!hero_photo_id (id, thumbnail_url, original_url),
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

  useEffect(() => {
    async function fetchPurchasesAndRetouch() {
      const supabase = createClient();
      const [paidOrdersRes, orderItemsRes, retouchRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("family_id", familyId)
          .eq("payment_status", "paid"),
        // Fetch actual purchased photo IDs from paid orders
        supabase
          .from("orders")
          .select("id, order_items(photo_id)")
          .eq("family_id", familyId)
          .eq("payment_status", "paid"),
        supabase
          .from("retouch_tasks")
          .select("photo_id, status, retouched_url")
          .eq("family_id", familyId),
      ]);

      setPaidOrdersCount(paidOrdersRes.count || 0);

      // Extract purchased photo IDs
      const purchasedIds = new Set<string>();
      for (const order of orderItemsRes.data || []) {
        const items = (order as any).order_items || [];
        for (const item of items) {
          if (item.photo_id) purchasedIds.add(item.photo_id);
        }
      }
      setPurchasedPhotoIds(purchasedIds);

      const map: Record<string, { status: string; retouchedUrl: string | null }> = {};
      let open = 0;
      for (const row of retouchRes.data || []) {
        const photoId = (row as any).photo_id as string;
        const status = (row as any).status as string;
        const retouchedUrl = ((row as any).retouched_url ?? null) as string | null;
        if (!photoId) continue;
        map[photoId] = { status, retouchedUrl };
        if (status !== "delivered") open += 1;
      }
      setRetouchByPhotoId(map);
      setOpenRetouchCount(open);
    }

    fetchPurchasesAndRetouch().catch(() => {});
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
        const photo = firstOf<PhotoEmbed>(r.photo ?? r.photos);
        if (!photo) continue;
        const session = firstOf<SessionEmbed>(photo.session ?? photo.photo_sessions);

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

        const child = firstOf<ChildEmbed>(r.child ?? r.children);
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

  // Fetch retouched photos for this family
  const fetchRetouchedPhotos = useCallback(async () => {
    setRetouchedLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("photos")
        .select("id, original_url, thumbnail_url, filename, created_at")
        .eq("family_id", familyId)
        .eq("is_retouched", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRetouchedPhotos(data || []);
    } catch (e) {
      console.error("Error fetching retouched photos:", e);
    } finally {
      setRetouchedLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchRetouchedPhotos().catch(() => {});
  }, [fetchRetouchedPhotos]);

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

  const handleSetHeroPhoto = async (photoId: string) => {
    if (!family) return;
    setSettingHeroPhotoId(photoId);
    try {
      // Toggle: if already hero, clear it; otherwise set it
      const newHeroId = family.hero_photo_id === photoId ? null : photoId;
      await setFamilyHeroPhoto(family.id, newHeroId);

      // Find the photo from familyPhotos to update hero_photo in state
      if (newHeroId) {
        const photo = familyPhotos.find(p => p.photoId === newHeroId);
        if (photo) {
          setFamily({
            ...family,
            hero_photo_id: newHeroId,
            hero_photo: [{ id: newHeroId, thumbnail_url: photo.thumbnailUrl, original_url: photo.thumbnailUrl }]
          });
        } else {
          setFamily({ ...family, hero_photo_id: newHeroId });
        }
      } else {
        setFamily({ ...family, hero_photo_id: null, hero_photo: undefined });
      }
    } catch (e) {
      console.error("Failed to set hero photo:", e);
    } finally {
      setSettingHeroPhotoId(null);
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
          phone,
          hero_photo_id,
          hero_photo:photos!hero_photo_id (id, thumbnail_url, original_url),
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

  const triggerRetouchUpload = (photoId: string) => {
    setRetouchUploadError(null);
    setRetouchUploadPhotoId(photoId);
    retouchFileInputRef.current?.click();
  };

  const handleRetouchFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const photoId = retouchUploadPhotoId;
    if (!file || !photoId) return;

    setRetouchUploadingPhotoId(photoId);
    setRetouchUploadError(null);
    try {
      const fd = new FormData();
      fd.set("familyId", familyId);
      fd.set("photoId", photoId);
      fd.set("file", file);

      const res = await fetch("/api/retouch/upload", { method: "POST", body: fd });
      const json = (await res.json()) as any;
      if (!json?.ok) throw new Error(json?.message || "Upload failed");

      setRetouchByPhotoId((prev) => ({
        ...prev,
        [photoId]: { status: "done", retouchedUrl: json.url ?? null },
      }));
    } catch (err) {
      setRetouchUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setRetouchUploadingPhotoId(null);
      setRetouchUploadPhotoId(null);
      if (retouchFileInputRef.current) retouchFileInputRef.current.value = "";
    }
  };

  // Retouched photos upload handlers
  const handleRetouchedDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;
    await uploadRetouchedFiles(files);
  };

  const handleRetouchedFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await uploadRetouchedFiles(files);
    if (retouchedFileInputRef.current) retouchedFileInputRef.current.value = "";
  };

  const uploadRetouchedFiles = async (files: File[]) => {
    setUploadingRetouched(true);
    setRetouchedUploadError(null);
    const errors: string[] = [];
    const supabase = createClient();

    try {
      for (const file of files) {
        // Check file size (10MB limit)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          errors.push(`${file.name}: File too large (max 10MB)`);
          continue;
        }

        const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `retouched/${familyId}/${Date.now()}-${safeName}`;

        // Upload directly to Supabase storage (bypasses Vercel size limits)
        const { error: uploadError } = await supabase.storage
          .from("photos-processed")
          .upload(path, file, { upsert: true });

        if (uploadError) {
          errors.push(`${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("photos-processed")
          .getPublicUrl(path);

        // Create photo record
        const { error: insertError } = await supabase
          .from("photos")
          .insert({
            family_id: familyId,
            is_retouched: true,
            original_url: urlData.publicUrl,
            thumbnail_url: urlData.publicUrl,
            filename: safeName,
            faces_detected: 0,
            needs_review: false,
          });

        if (insertError) {
          errors.push(`${file.name}: ${insertError.message}`);
        }
      }
      await fetchRetouchedPhotos();
      if (errors.length > 0) {
        setRetouchedUploadError(errors.join("; "));
      }
    } catch (err) {
      console.error("Upload error:", err);
      setRetouchedUploadError("Upload failed. Please try again.");
    } finally {
      setUploadingRetouched(false);
    }
  };

  const handleDeleteRetouchedPhoto = async (photoId: string) => {
    if (deletingPhotoId) return;
    setDeletingPhotoId(photoId);
    try {
      const res = await fetch(`/api/families/${familyId}/photos?photoId=${photoId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        setRetouchedPhotos((prev) => prev.filter((p) => p.id !== photoId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeletingPhotoId(null);
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
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2 text-charcoal-300">
              <User className="w-4 h-4" />
              <span>{family.children.length} children</span>
            </div>
            <div className="flex items-center gap-2 text-charcoal-300">
              <Camera className="w-4 h-4" />
              <span>{withReferencePhotoCount} with reference photos</span>
            </div>
            {family.email && (
              <div className="flex items-center gap-2 text-charcoal-300">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{family.email}</span>
              </div>
            )}
            {family.phone && (
              <div className="flex items-center gap-2 text-charcoal-300">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">{family.phone}</span>
              </div>
            )}
            {paidOrdersCount > 0 && (
              <div className="flex items-center gap-2 text-charcoal-300">
                <Badge variant="success">{paidOrdersCount} paid orders</Badge>
              </div>
            )}
            {openRetouchCount > 0 && (
              <div className="flex items-center gap-2 text-charcoal-300">
                <Badge variant="warning">{openRetouchCount} retouch open</Badge>
              </div>
            )}
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

          {/* Children Grid - show hero photo as main image when available */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {family.children.map((child) => {
              // Use hero photo if available, otherwise fall back to reference photo
              const heroPhotoUrl = family.hero_photo?.[0]?.thumbnail_url || family.hero_photo?.[0]?.original_url;
              const displayPhotoUrl = heroPhotoUrl || child.reference_photo_url;

              return (
              <Card key={child.id} variant="glass" className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Main Photo - Hero photo or Reference photo */}
                  <div className="aspect-square bg-charcoal-800 relative">
                    {displayPhotoUrl ? (
                      <Image
                        src={displayPhotoUrl}
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
              );
            })}
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
                    <Glow
                      key={p.photoId}
                      variant="gold"
                      disabled={!purchasedPhotoIds.has(p.photoId)}
                      className="rounded-lg"
                    >
                    <a
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

                        {/* HD badge for purchased photos */}
                        {purchasedPhotoIds.has(p.photoId) && (
                          <div className="absolute top-2 left-10 px-1.5 py-0.5 rounded bg-gold-500 text-black text-[10px] font-bold flex items-center gap-0.5">
                            <Download className="w-2.5 h-2.5" />
                            HD
                          </div>
                        )}

                        {retouchByPhotoId[p.photoId] && (
                          <div className="absolute bottom-2 left-2">
                            <Badge variant="default" className="text-[11px] bg-black/60 border border-charcoal-700">
                              {retouchByPhotoId[p.photoId].status}
                            </Badge>
                          </div>
                        )}

                        {retouchByPhotoId[p.photoId] && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              triggerRetouchUpload(p.photoId);
                            }}
                            disabled={retouchUploadingPhotoId === p.photoId}
                            className="absolute bottom-2 right-2 px-2 py-1 text-[11px] rounded-md bg-teal-500/30 text-teal-100 hover:bg-teal-500/45 transition-colors disabled:opacity-60 opacity-0 group-hover:opacity-100"
                            title="Upload retouched file"
                          >
                            {retouchUploadingPhotoId === p.photoId ? "Uploading..." : "Upload"}
                          </button>
                        )}
                        {/* Remove button - shown on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemovePhoto(p).catch(() => {});
                          }}
                          disabled={pendingRemovePhotoId === p.photoId}
                          className="absolute top-2 left-2 px-2 py-1 text-xs rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors disabled:opacity-60 opacity-0 group-hover:opacity-100"
                          title="Remove this photo from this family (undo available)"
                        >
                          {pendingRemovePhotoId === p.photoId ? "Removing..." : "Remove"}
                        </button>
                        {/* Set as family photo button - ALWAYS visible */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSetHeroPhoto(p.photoId).catch(() => {});
                          }}
                          disabled={settingHeroPhotoId === p.photoId}
                          className={`absolute top-2 right-2 p-1.5 rounded-md transition-colors disabled:opacity-60 ${
                            family?.hero_photo_id === p.photoId
                              ? "bg-gold-500 text-white"
                              : "bg-black/60 text-white hover:bg-gold-500/80"
                          }`}
                          title={family?.hero_photo_id === p.photoId ? "Remove as family photo" : "Set as family photo"}
                        >
                          {settingHeroPhotoId === p.photoId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Star className={`w-3 h-3 ${family?.hero_photo_id === p.photoId ? "fill-current" : ""}`} />
                          )}
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
                    </Glow>
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

          {/* Retouched Photos Section */}
          <Card variant="glass">
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-400" />
                <h3 className="font-medium text-white">Bewerkte Foto&apos;s</h3>
                <span className="text-sm text-charcoal-400">
                  ({retouchedPhotos.length} photos)
                </span>
              </div>

              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleRetouchedDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragOver
                    ? "border-pink-400 bg-pink-500/10"
                    : "border-charcoal-600 hover:border-charcoal-500"
                }`}
              >
                {uploadingRetouched ? (
                  <div className="flex items-center justify-center gap-2 text-charcoal-300">
                    <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
                    Uploading...
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImagePlus className="w-8 h-8 mx-auto text-charcoal-500" />
                    <p className="text-charcoal-400">
                      Drop retouched photos here or{" "}
                      <button
                        type="button"
                        onClick={() => retouchedFileInputRef.current?.click()}
                        className="text-pink-400 hover:text-pink-300 underline"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-xs text-charcoal-500">
                      Supports multiple files
                    </p>
                  </div>
                )}
              </div>

              {/* Upload Error Message */}
              {retouchedUploadError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{retouchedUploadError}</span>
                  <button
                    type="button"
                    onClick={() => setRetouchedUploadError(null)}
                    className="ml-auto hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Retouched Photos Grid */}
              {retouchedLoading ? (
                <div className="flex items-center gap-2 text-charcoal-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : retouchedPhotos.length === 0 ? (
                <p className="text-sm text-charcoal-500">
                  No retouched photos yet. Upload some above.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {retouchedPhotos.map((photo) => (
                    <div key={photo.id} className="group relative">
                      <a
                        href={photo.original_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <div className="aspect-square rounded-lg overflow-hidden border border-charcoal-700 group-hover:border-pink-400/50 transition-colors">
                          <img
                            src={photo.thumbnail_url || photo.original_url}
                            alt={photo.filename || "Retouched photo"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </a>
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteRetouchedPhoto(photo.id)}
                        disabled={deletingPhotoId === photo.id}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-60"
                        title="Delete photo"
                      >
                        {deletingPhotoId === photo.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                      {/* Filename */}
                      {photo.filename && (
                        <p className="mt-1 text-xs text-charcoal-500 truncate">
                          {photo.filename}
                        </p>
                      )}
                    </div>
                  ))}
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

          <input
            ref={retouchFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleRetouchFileSelect}
          />

          <input
            ref={retouchedFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleRetouchedFileSelect}
          />

          {retouchUploadError && (
            <Card variant="glass" className="border-red-500/30 bg-red-500/10">
              <CardContent className="flex items-center gap-3 py-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400">{retouchUploadError}</p>
                <button
                  onClick={() => setRetouchUploadError(null)}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          )}

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
