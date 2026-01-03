import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// POST - Handle retouched photo upload (supports both legacy FormData and new JSON)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;

    if (!familyId) {
      return NextResponse.json(
        { ok: false, message: "Missing familyId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from("families")
      .select("id")
      .eq("id", familyId)
      .single();

    if (familyError || !family) {
      return NextResponse.json(
        { ok: false, message: "Family not found" },
        { status: 404 }
      );
    }

    let url: string;
    let filename: string;

    // Check content type to determine how to parse the request
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // New approach: JSON with url and filename (storage upload done client-side)
      const body = await req.json();
      url = body.url;
      filename = body.filename;

      if (!url || !filename) {
        return NextResponse.json(
          { ok: false, message: "Missing url or filename" },
          { status: 400 }
        );
      }
    } else {
      // Legacy approach: FormData with file (upload via API)
      const form = await req.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, message: "Missing file" },
          { status: 400 }
        );
      }

      const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `retouched/${familyId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("photos-processed")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });

      if (uploadError) {
        console.error("[families/photos] Upload error:", uploadError);
        return NextResponse.json(
          { ok: false, message: uploadError.message },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage
        .from("photos-processed")
        .getPublicUrl(path);

      url = urlData.publicUrl;
      filename = safeName;
    }

    // Create photo record (uses service role - bypasses RLS)
    const { data: photo, error: insertError } = await supabase
      .from("photos")
      .insert({
        family_id: familyId,
        is_retouched: true,
        original_url: url,
        thumbnail_url: url,
        filename: filename,
        faces_detected: 0,
        needs_review: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[families/photos] Insert error:", insertError);
      return NextResponse.json(
        { ok: false, message: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, photo });
  } catch (e) {
    console.error("[families/photos] POST error:", e);
    return NextResponse.json(
      { ok: false, message: "Failed to process request" },
      { status: 500 }
    );
  }
}

// DELETE - Remove retouched photo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get("photoId");

    if (!familyId || !photoId) {
      return NextResponse.json(
        { ok: false, message: "Missing familyId or photoId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get photo to find storage path
    const { data: photo, error: fetchError } = await supabase
      .from("photos")
      .select("id, original_url, family_id, is_retouched")
      .eq("id", photoId)
      .eq("family_id", familyId)
      .eq("is_retouched", true)
      .single();

    if (fetchError || !photo) {
      return NextResponse.json(
        { ok: false, message: "Photo not found" },
        { status: 404 }
      );
    }

    // Extract storage path from URL
    const url = new URL(photo.original_url);
    const pathMatch = url.pathname.match(/\/photos-processed\/(.+)$/);
    if (pathMatch) {
      const storagePath = decodeURIComponent(pathMatch[1]);
      await supabase.storage.from("photos-processed").remove([storagePath]);
    }

    // Delete photo record
    const { error: deleteError } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId);

    if (deleteError) {
      console.error("[families/photos] Delete error:", deleteError);
      return NextResponse.json(
        { ok: false, message: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[families/photos] DELETE error:", e);
    return NextResponse.json(
      { ok: false, message: "Delete failed" },
      { status: 500 }
    );
  }
}
