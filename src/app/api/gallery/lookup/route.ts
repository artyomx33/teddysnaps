import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

type LookupRequest = {
  accessCode?: string;
};

function createSupabaseClientForGallery() {
  // Prefer service role (bypasses RLS + avoids auth/session coupling), but fall back to anon
  // so production doesn't hard-fail if SUPABASE_SERVICE_ROLE_KEY isn't configured yet.
  try {
    return createAdminClient();
  } catch (e) {
    console.error("[gallery/lookup] Admin client unavailable, falling back to anon client:", e);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createSupabaseJsClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  let body: LookupRequest | null = null;
  try {
    body = (await req.json()) as LookupRequest;
  } catch {
    // ignore
  }

  const accessCode = (body?.accessCode ?? "").trim().toUpperCase();
  if (!accessCode) {
    return NextResponse.json(
      { ok: false, message: "Missing accessCode" },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseClientForGallery();

    const { data: family, error: familyError } = await supabase
      .from("families")
      .select("id, family_name, location_id")
      .eq("access_code", accessCode)
      .maybeSingle();

    if (familyError) {
      console.error("[gallery/lookup] Error fetching family:", familyError);
      return NextResponse.json(
        { ok: false, message: "Failed to load family" },
        { status: 500 }
      );
    }

    if (!family) {
      return NextResponse.json(
        { ok: false, message: "Invalid access code" },
        { status: 404 }
      );
    }

    if (!family.location_id) {
      return NextResponse.json(
        {
          ok: false,
          message: "This family is missing a location. Ask the photographer to fix it in Admin → Families.",
        },
        { status: 422 }
      );
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from("photo_sessions")
      .select("id, name, shoot_date")
      .eq("location_id", family.location_id)
      .order("shoot_date", { ascending: false });

    if (sessionsError) {
      console.error("[gallery/lookup] Error fetching sessions:", sessionsError);
      return NextResponse.json(
        { ok: false, message: "Failed to load sessions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      accessCode,
      familyName: family.family_name,
      locationId: family.location_id,
      sessions: sessions ?? [],
    });
  } catch (e) {
    console.error("[gallery/lookup] Unhandled error:", e);
    return NextResponse.json(
      {
        ok: false,
        // Keep message generic for production, but this should avoid hard failing on missing service role.
        message: "Unexpected server error",
      },
      { status: 500 }
    );
  }
}


