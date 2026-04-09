import { unlink } from "fs/promises";
import path from "path";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getBlobReadWriteToken } from "@/lib/blob-token";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isVercelBlobUrl(url: string): boolean {
  return /blob\.vercel-storage\.com\//i.test(url);
}

async function removeStoredMedia(mediaUrl: string | null | undefined) {
  if (!mediaUrl) return;

  if (isVercelBlobUrl(mediaUrl)) {
    const token = getBlobReadWriteToken();
    if (!token) {
      console.warn(
        "admin delete: BLOB_READ_WRITE_TOKEN missing; cannot remove file from Blob storage"
      );
      return;
    }
    try {
      await del(mediaUrl, { token });
    } catch (e) {
      console.error("admin delete: Vercel Blob del() failed", e);
    }
    return;
  }

  if (mediaUrl.startsWith("/dev-media/")) {
    const rel = mediaUrl.replace(/^\//, "");
    const abs = path.join(process.cwd(), "public", rel);
    try {
      await unlink(abs);
    } catch (e) {
      console.error("admin delete: local dev-media unlink failed", e);
    }
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const expected = process.env.JORDAN_ADMIN_SECRET?.trim();
  if (!expected || expected.length < 8) {
    return NextResponse.json({ error: "Admin not configured." }, { status: 503 });
  }

  const secret = req.headers.get("x-jordan-admin-secret")?.trim();
  if (!secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid entry id." }, { status: 400 });
  }

  try {
    const sql = getSql();
    const existing = await sql<{ media_url: string | null }[]>`
      SELECT media_url FROM guestbook_entry WHERE id = ${id}
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    const mediaUrl = existing[0]?.media_url ?? null;
    await removeStoredMedia(mediaUrl);

    const deleted = await sql`
      DELETE FROM guestbook_entry WHERE id = ${id} RETURNING id
    `;
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin delete entry", e);
    return NextResponse.json({ error: "Could not delete entry." }, { status: 500 });
  }
}
