import { NextResponse } from "next/server";
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
  } catch {
    return NextResponse.json(
      {
        error:
          "Database unavailable. Set DATABASE_URL or POSTGRES_URL and run schema.sql.",
      },
      { status: 503 }
    );
  }
}
