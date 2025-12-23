"use client";

import { useState, useEffect, useRef } from "react";
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

export default function FamilyDetailPage() {
  const params = useParams();
  const familyId = params.familyId as string;
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollingChildId, setEnrollingChildId] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
