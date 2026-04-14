import { NextResponse } from "next/server";
import { getDatabaseUrl } from "@/lib/db";
import { getPublicStats } from "@/lib/entries-query";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getPublicStats();
    if (!stats) {
      return NextResponse.json(
        { error: "Could not load stats." },
        { status: 503 }
      );
    }
    return NextResponse.json(stats);
  } catch (e) {
    console.error("[api/stats]", e);
    const url = getDatabaseUrl();
    if (!url) {
      return NextResponse.json(
        {
          error:
            "Database unavailable: no connection string on this deployment. In Vercel → your project → Storage, connect Neon to this app and enable Production (or add DATABASE_URL / POSTGRES_URL / POSTGRES_PRISMA_URL under Settings → Environment Variables), then Redeploy.",
        },
        { status: 503 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (
      /relation\s+["']?guestbook_entry["']?\s+does not exist/i.test(msg) ||
      msg.includes("42P01")
    ) {
      return NextResponse.json(
        {
          error:
            "Database connected, but tables are missing. In Neon → SQL Editor, run the full schema.sql from this repo, then refresh the site.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Database unreachable from this deployment. Confirm Neon is linked for Production and redeploy; open Vercel → Logs while loading the page to see the exact error.",
      },
      { status: 503 }
    );
  }
}
