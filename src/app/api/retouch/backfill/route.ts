import { NextRequest, NextResponse } from "next/server";
import { backfillPaidOrdersRetouch } from "@/lib/retouch/entitlements";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let limit = 200;
    try {
      const body = (await req.json()) as { limit?: number };
      if (typeof body?.limit === "number" && Number.isFinite(body.limit)) {
        limit = Math.max(1, Math.min(1000, Math.floor(body.limit)));
      }
    } catch {
      // ignore
    }

    const res = await backfillPaidOrdersRetouch(limit);
    if (!res.ok) return NextResponse.json(res, { status: 500 });
    return NextResponse.json(res);
  } catch (e) {
    console.error("[retouch/backfill] error", e);
    return NextResponse.json({ ok: false, message: "Backfill failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { backfillPaidOrdersRetouch } from "@/lib/retouch/entitlements";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let limit = 200;
    try {
      const body = (await req.json()) as { limit?: number };
      if (typeof body?.limit === "number" && Number.isFinite(body.limit)) {
        limit = Math.max(1, Math.min(1000, Math.floor(body.limit)));
      }
    } catch {
      // ignore
    }

    const res = await backfillPaidOrdersRetouch(limit);
    if (!res.ok) {
      return NextResponse.json(res, { status: 500 });
    }
    return NextResponse.json(res);
  } catch (e) {
    console.error("[retouch/backfill] error", e);
    return NextResponse.json({ ok: false, message: "Backfill failed" }, { status: 500 });
  }
}


