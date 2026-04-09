import { NextResponse } from "next/server";
import { listAllEntries } from "@/lib/entries-query";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await listAllEntries(200);
    return NextResponse.json({ entries });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        entries: [],
        error:
          "Cannot reach Postgres. In Vercel → Project → Environment Variables, set DATABASE_URL or POSTGRES_URL, redeploy, then run schema.sql in the Neon SQL editor.",
      },
      { status: 503 }
    );
  }
}
