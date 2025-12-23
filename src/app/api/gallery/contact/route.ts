import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type ContactRequest = {
  accessCode?: string;
  email?: string;
  whatsapp?: string;
};

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Simple pragmatic check (avoids obvious garbage)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeWhatsapp(input: string): string {
  return input.trim();
}

function isValidWhatsappNumber(value: string): boolean {
  // Accept "+", digits, spaces, dashes, parentheses. Enforce min digit count.
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return false;
  return /^[0-9+\-() ]+$/.test(value);
}

export async function POST(req: Request) {
  let body: ContactRequest | null = null;
  try {
    body = (await req.json()) as ContactRequest;
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

  const rawEmail = body?.email ?? "";
  const rawWhatsapp = body?.whatsapp ?? "";

  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  const whatsapp = rawWhatsapp ? normalizeWhatsapp(rawWhatsapp) : "";

  if (email && !isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, message: "Please enter a valid email address" },
      { status: 400 }
    );
  }

  if (whatsapp && !isValidWhatsappNumber(whatsapp)) {
    return NextResponse.json(
      { ok: false, message: "Please enter a valid WhatsApp number" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    const { data: family, error: familyError } = await supabase
      .from("families")
      .select("id, email, phone")
      .eq("access_code", accessCode)
      .maybeSingle();

    if (familyError) {
      console.error("[gallery/contact] Error fetching family:", familyError);
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

    // Email is required to open session folders.
    const hasEmailAlready = !!(family.email && String(family.email).trim());
    if (!hasEmailAlready && !email) {
      return NextResponse.json(
        { ok: false, message: "Email is required to continue" },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {};
    if (email) update.email = email;
    // whatsapp is optional; allow clearing by sending empty string
    if (body?.whatsapp !== undefined) update.phone = whatsapp || null;

    if (Object.keys(update).length > 0) {
      const { error: updateError } = await supabase
        .from("families")
        .update(update)
        .eq("id", family.id);

      if (updateError) {
        console.error("[gallery/contact] Error updating family:", updateError);
        return NextResponse.json(
          { ok: false, message: "Failed to save contact details" },
          { status: 500 }
        );
      }
    }

    const nextEmail = (email || family.email || "").trim() || null;
    const nextWhatsapp =
      body?.whatsapp !== undefined
        ? whatsapp || null
        : ((family.phone as string | null) ?? null);

    return NextResponse.json({
      ok: true,
      accessCode,
      email: nextEmail,
      whatsapp: nextWhatsapp,
    });
  } catch (e) {
    console.error("[gallery/contact] Unhandled error:", e);
    return NextResponse.json(
      { ok: false, message: "Unexpected server error" },
      { status: 500 }
    );
  }
}
