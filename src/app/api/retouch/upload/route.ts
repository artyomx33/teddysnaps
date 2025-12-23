import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const familyId = String(form.get("familyId") || "").trim();
    const photoId = String(form.get("photoId") || "").trim();
    const file = form.get("file");

    if (!familyId || !photoId) {
      return NextResponse.json({ ok: false, message: "Missing familyId/photoId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Missing file" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `retouched/${familyId}/${photoId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("photos-processed")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    if (uploadError) {
      return NextResponse.json({ ok: false, message: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("photos-processed").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Update retouch task (best effort) and photo processed_url
    await supabase
      .from("retouch_tasks")
      .update({
        retouched_url: publicUrl,
        status: "done",
        done_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("family_id", familyId)
      .eq("photo_id", photoId);

    await supabase.from("photos").update({ processed_url: publicUrl }).eq("id", photoId);

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e) {
    console.error("[retouch/upload] error", e);
    return NextResponse.json({ ok: false, message: "Upload failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const familyId = String(form.get("familyId") || "").trim();
    const photoId = String(form.get("photoId") || "").trim();
    const file = form.get("file");

    if (!familyId || !photoId) {
      return NextResponse.json({ ok: false, message: "Missing familyId/photoId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Missing file" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `retouched/${familyId}/${photoId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("photos-processed")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    if (uploadError) {
      return NextResponse.json({ ok: false, message: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("photos-processed").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Update task + photo record (best effort)
    await supabase
      .from("retouch_tasks")
      .update({
        retouched_url: publicUrl,
        status: "done",
        done_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("family_id", familyId)
      .eq("photo_id", photoId);

    await supabase.from("photos").update({ processed_url: publicUrl }).eq("id", photoId);

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e) {
    console.error("[retouch/upload] error", e);
    return NextResponse.json({ ok: false, message: "Upload failed" }, { status: 500 });
  }
}


