import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBulkEmail } from "@/lib/email/send";
import { BulkEmailType } from "@/lib/email/templates/bulk-message";

export const runtime = "nodejs";

// Rate limiting: 5 emails per batch, 600ms delay between batches
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 600;
const MAX_EMAILS_PER_REQUEST = 50;

interface BulkEmailRequest {
  familyIds: string[];
  templateType: BulkEmailType;
  customMessage?: string;
}

interface SentEmail {
  type: BulkEmailType;
  sent_at: string;
  status: "sent" | "failed";
  error?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BulkEmailRequest;
    const { familyIds, templateType, customMessage } = body;

    if (!familyIds || !Array.isArray(familyIds) || familyIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No families selected" },
        { status: 400 }
      );
    }

    if (!templateType || !["reminder", "promotional", "custom"].includes(templateType)) {
      return NextResponse.json(
        { ok: false, message: "Invalid template type" },
        { status: 400 }
      );
    }

    if (familyIds.length > MAX_EMAILS_PER_REQUEST) {
      return NextResponse.json(
        {
          ok: false,
          message: `Too many recipients. Max ${MAX_EMAILS_PER_REQUEST} per request.`,
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch families with their children and session info
    const { data: families, error: fetchError } = await supabase
      .from("families")
      .select(
        `
        id,
        family_name,
        email,
        access_code,
        sent_emails,
        children (
          first_name
        )
      `
      )
      .in("id", familyIds)
      .not("email", "is", null);

    if (fetchError) {
      console.error("[admin/email/bulk] Fetch error:", fetchError);
      return NextResponse.json(
        { ok: false, message: "Failed to fetch families" },
        { status: 500 }
      );
    }

    if (!families || families.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No families with email addresses found" },
        { status: 400 }
      );
    }

    // Base URL for gallery links
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://snaps.teddykids.nl";

    const results: {
      sent: number;
      failed: number;
      errors: Array<{ familyId: string; email: string; error: string }>;
    } = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < families.length; i += BATCH_SIZE) {
      const batch = families.slice(i, i + BATCH_SIZE);

      // Send emails in parallel within batch
      const batchResults = await Promise.all(
        batch.map(async (family) => {
          const email = family.email as string;
          const childName =
            family.children && family.children.length > 0
              ? family.children[0].first_name
              : undefined;

          const galleryUrl = `${baseUrl}/gallery?code=${family.access_code}`;

          const result = await sendBulkEmail({
            to: email,
            familyName: family.family_name,
            childName,
            templateType,
            customMessage,
            galleryUrl,
          });

          // Record the sent email on the family
          const sentEmailRecord: SentEmail = {
            type: templateType,
            sent_at: new Date().toISOString(),
            status: result.ok ? "sent" : "failed",
            ...(result.error && { error: result.error }),
          };

          // Append to sent_emails array
          const existingSentEmails = (family.sent_emails as SentEmail[]) || [];
          await supabase
            .from("families")
            .update({
              sent_emails: [...existingSentEmails, sentEmailRecord],
            })
            .eq("id", family.id);

          return {
            familyId: family.id,
            email,
            ok: result.ok,
            error: result.error,
          };
        })
      );

      // Tally results
      for (const result of batchResults) {
        if (result.ok) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            familyId: result.familyId,
            email: result.email,
            error: result.error || "Unknown error",
          });
        }
      }

      // Delay between batches (except for last batch)
      if (i + BATCH_SIZE < families.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return NextResponse.json({
      ok: true,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors,
    });
  } catch (e) {
    console.error("[admin/email/bulk] error", e);
    return NextResponse.json(
      { ok: false, message: "Failed to send emails" },
      { status: 500 }
    );
  }
}
